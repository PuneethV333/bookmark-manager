import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import * as cheerio from 'cheerio';
import pLimit from 'p-limit';

import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { SITE_MATCHERS } from './constants/site-matchers';
import { scrapeAsuraScans } from './scraper/asurascans';
import { scrapeKingOfShojo } from './scraper/kingofshojo';

const SCRAPE_CACHE_TTL_SECONDS = 10 * 60;
const STALE_AFTER_MINUTES = 5;

function scrapeCacheKey(site: string, slug: string): string {
  return `scrape:${site}:${slug}`;
}

function isMatchingDomain(hostname: string, domain: string): boolean {
  return hostname === domain || hostname.endsWith(`.${domain}`);
}

function matchBookmarkToSite(url: string): {
  site: string;
  slug: string;
} | null {
  try {
    const hostname = new URL(url).hostname.replace(/^www\./, '');

    for (const [domain, extractSlug] of Object.entries(SITE_MATCHERS)) {
      if (!isMatchingDomain(hostname, domain)) {
        continue;
      }

      const slug = extractSlug(url);

      if (slug) {
        return {
          site: domain,
          slug,
        };
      }
    }
  } catch {
    return null;
  }

  return null;
}

type ScraperResult = {
  number: number;
} | null;

type Scraper = (url: string) => Promise<ScraperResult>;

const SCRAPERS: Record<string, Scraper> = {
  'asurascans.com': scrapeAsuraScans,
  'kingofshojo.com': scrapeKingOfShojo,
};

@Injectable()
export class BookmarksService {
  private readonly logger = new Logger(BookmarksService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  async importFromHtml(html: string, userId: string) {
    const $ = cheerio.load(html);

    const links: {
      url: string;
      title: string;
    }[] = [];

    $('a').each((_, el) => {
      const href = $(el).attr('href');

      if (!href) {
        return;
      }

      links.push({
        url: href,
        title: $(el).text().trim(),
      });
    });

    const matched = links
      .map((link) => {
        const match = matchBookmarkToSite(link.url);

        if (!match) {
          return null;
        }

        return {
          ...link,
          ...match,
        };
      })
      .filter(
        (
          bookmark,
        ): bookmark is {
          url: string;
          title: string;
          site: string;
          slug: string;
        } => bookmark !== null,
      );

    const deduped = Array.from(
      new Map(matched.map((bookmark) => [bookmark.url, bookmark])).values(),
    );

    const skipped = links.length - deduped.length;

    const existing = await this.prisma.bookmark.findMany({
      where: {
        userId,
        url: { in: deduped.map((bookmark) => bookmark.url) },
      },
      select: { url: true, lastChapter: true },
    });
    const existingChapterByUrl = new Map(
      existing.map((bookmark) => [bookmark.url, bookmark.lastChapter]),
    );

    /*
     * Limit concurrent requests PER SITE.
     *
     * Example:
     *   Asura      -> max 3 concurrent requests
     *   KingShojo  -> max 3 concurrent requests
     *
     * Different sites can still be scraped concurrently.
     */
    const limiters = new Map<string, ReturnType<typeof pLimit>>();

    const limiterFor = (site: string) => {
      let limiter = limiters.get(site);

      if (!limiter) {
        limiter = pLimit(3);
        limiters.set(site, limiter);
      }

      return limiter;
    };

    /*
     * Scrape the latest chapter for every supported bookmark.
     */
    const withChapters = await Promise.all(
      deduped.map(async (bookmark) => {
        const scraper = SCRAPERS[bookmark.site];

        /*
         * Site is recognized by SITE_MATCHERS but does not
         * have a scraper implementation yet.
         */
        if (!scraper) {
          return {
            ...bookmark,
            lastChapter: null,
            lastCheckedAt: null,
          };
        }

        const limit = limiterFor(bookmark.site);
        const cacheKey = scrapeCacheKey(bookmark.site, bookmark.slug);

        let result = await this.redis
          .get<{ number: number }>(cacheKey)
          .catch(() => null);

        if (!result) {
          result = await limit(() => scraper(bookmark.url)).catch(
            (error: unknown) => {
              const message =
                error instanceof Error ? error.message : String(error);

              this.logger.warn(
                `Chapter scrape failed for ${bookmark.url}: ${message}`,
              );

              return null;
            },
          );

          if (result) {
            await this.redis
              .set(cacheKey, result, SCRAPE_CACHE_TTL_SECONDS)
              .catch((error: unknown) => {
                const message =
                  error instanceof Error ? error.message : String(error);
                this.logger.warn(`Failed to cache scrape result: ${message}`);
              });
          }
        }

        const existingChapter = existingChapterByUrl.get(bookmark.url) ?? null;

        const lastChapter = result
          ? Math.max(result.number, existingChapter ?? result.number)
          : null;

        return {
          ...bookmark,
          lastChapter,

          lastCheckedAt: result ? new Date() : null,
        };
      }),
    );

    const results = await Promise.all(
      withChapters.map((bookmark) =>
        this.prisma.bookmark.upsert({
          where: {
            userId_url: {
              userId,
              url: bookmark.url,
            },
          },

          update:
            bookmark.lastChapter !== null
              ? {
                  lastChapter: bookmark.lastChapter,
                  lastCheckedAt: bookmark.lastCheckedAt,
                }
              : {},

          create: {
            userId,
            url: bookmark.url,
            title: bookmark.title || null,
            site: bookmark.site,
            slug: bookmark.slug,
            lastChapter: bookmark.lastChapter,
            lastCheckedAt: bookmark.lastCheckedAt,
          },
        }),
      ),
    );

    const failedScrapes = withChapters.filter(
      (bookmark) => bookmark.lastChapter === null,
    ).length;

    return {
      imported: results.length,
      skipped,
      failedScrapes,
    };
  }

  /**
   * Individual check: re-scrape one bookmark right now (cache-first)
   * and report whether a new chapter is available. lastChapter is only
   * bumped when the scrape succeeded and the number actually moved
   * forward; a failed scrape leaves stored data untouched.
   */
  async checkOne(id: string, userId: string) {
    const bookmark = await this.prisma.bookmark.findFirst({
      where: { id, userId },
    });

    if (!bookmark) {
      throw new NotFoundException('Bookmark not found');
    }

    const scraper = SCRAPERS[bookmark.site];
    if (!scraper) {
      return {
        id: bookmark.id,
        lastChapter: bookmark.lastChapter,
        hasNewChapter: false,
        checked: false,
      };
    }

    const cacheKey = scrapeCacheKey(bookmark.site, bookmark.slug);

    let result = await this.redis
      .get<{ number: number }>(cacheKey)
      .catch(() => null);

    if (!result) {
      result = await scraper(bookmark.url).catch((error: unknown) => {
        const message = error instanceof Error ? error.message : String(error);
        this.logger.warn(
          `Chapter scrape failed for ${bookmark.url}: ${message}`,
        );
        return null;
      });

      if (result) {
        await this.redis
          .set(cacheKey, result, SCRAPE_CACHE_TTL_SECONDS)
          .catch((error: unknown) => {
            const message =
              error instanceof Error ? error.message : String(error);
            this.logger.warn(`Failed to cache scrape result: ${message}`);
          });
      }
    }

    if (!result) {
      return {
        id: bookmark.id,
        lastChapter: bookmark.lastChapter,
        hasNewChapter: false,
        checked: false,
      };
    }

    const hasNewChapter =
      bookmark.lastChapter === null || result.number > bookmark.lastChapter;

    const updated = await this.prisma.bookmark.update({
      where: { id: bookmark.id },
      data: hasNewChapter
        ? { lastChapter: result.number, lastCheckedAt: new Date() }
        : { lastCheckedAt: new Date() },
    });

    return {
      id: updated.id,
      lastChapter: updated.lastChapter,
      hasNewChapter,
      checked: true,
    };
  }

  /**
   * Batch check: re-scrape every bookmark for the user (cache-first,
   * per-site rate limited) and report which ones moved forward.
   * Bookmarks checked more recently than STALE_AFTER_MINUTES are
   * skipped so this doesn't re-hit sites you already just checked.
   */
  async batchCheck(userId: string) {
    const bookmarks = await this.prisma.bookmark.findMany({
      where: { userId },
      select: {
        id: true,
        url: true,
        title: true,
        site: true,
        slug: true,
        lastChapter: true,
        lastCheckedAt: true,
      },
    });

    const staleBefore = new Date(Date.now() - STALE_AFTER_MINUTES * 60_000);

    const limiters = new Map<string, ReturnType<typeof pLimit>>();
    const limiterFor = (site: string) => {
      let limiter = limiters.get(site);
      if (!limiter) {
        limiter = pLimit(3);
        limiters.set(site, limiter);
      }
      return limiter;
    };

    const results = await Promise.all(
      bookmarks.map(async (bookmark) => {
        const isFresh =
          bookmark.lastCheckedAt !== null &&
          bookmark.lastCheckedAt > staleBefore;

        if (isFresh) {
          return {
            id: bookmark.id,
            title: bookmark.title,
            lastChapter: bookmark.lastChapter,
            hasNewChapter: false,
            checked: false,
            skippedReason: 'recently checked' as const,
          };
        }

        const scraper = SCRAPERS[bookmark.site];
        if (!scraper) {
          return {
            id: bookmark.id,
            title: bookmark.title,
            lastChapter: bookmark.lastChapter,
            hasNewChapter: false,
            checked: false,
          };
        }

        const cacheKey = scrapeCacheKey(bookmark.site, bookmark.slug);
        const limit = limiterFor(bookmark.site);

        let result = await this.redis
          .get<{ number: number }>(cacheKey)
          .catch(() => null);

        if (!result) {
          result = await limit(() => scraper(bookmark.url)).catch(
            (error: unknown) => {
              const message =
                error instanceof Error ? error.message : String(error);
              this.logger.warn(
                `Chapter scrape failed for ${bookmark.url}: ${message}`,
              );
              return null;
            },
          );

          if (result) {
            await this.redis
              .set(cacheKey, result, SCRAPE_CACHE_TTL_SECONDS)
              .catch((error: unknown) => {
                const message =
                  error instanceof Error ? error.message : String(error);
                this.logger.warn(`Failed to cache scrape result: ${message}`);
              });
          }
        }

        if (!result) {
          return {
            id: bookmark.id,
            title: bookmark.title,
            lastChapter: bookmark.lastChapter,
            hasNewChapter: false,
            checked: false,
          };
        }

        const hasNewChapter =
          bookmark.lastChapter === null || result.number > bookmark.lastChapter;

        const updated = await this.prisma.bookmark.update({
          where: { id: bookmark.id },
          data: hasNewChapter
            ? { lastChapter: result.number, lastCheckedAt: new Date() }
            : { lastCheckedAt: new Date() },
        });

        return {
          id: updated.id,
          title: bookmark.title,
          lastChapter: updated.lastChapter,
          hasNewChapter,
          checked: true,
        };
      }),
    );

    return {
      total: results.length,
      checked: results.filter((r) => r.checked).length,
      newChapters: results.filter((r) => r.hasNewChapter),
      failed: results.filter((r) => r.checked === false && !r.skippedReason)
        .length,
      skipped: results.filter((r) => r.skippedReason === 'recently checked')
        .length,
    };
  }
}
