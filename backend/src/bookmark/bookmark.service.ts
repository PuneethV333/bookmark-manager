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
const SCRAPE_CONCURRENCY_PER_SITE = 3;
const DB_WRITE_CONCURRENCY = 10;

function scrapeCacheKey(site: string, slug: string): string {
  return `scrape:${site}:${slug}`;
}

function isMatchingDomain(hostname: string, domain: string): boolean {
  return hostname === domain || hostname.endsWith(`.${domain}`);
}

function matchBookmarkToSite(
  url: string,
): { site: string; slug: string } | null {
  try {
    const parsed = new URL(url);

    // Bookmark exports can contain javascript:, file:, place: ... links.
    // Only ever fetch http(s).
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return null;
    }

    const hostname = parsed.hostname.replace(/^www\./, '');

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

type ScrapedChapter = {
  number: number;
  image?: string;
};

type Scraper = (url: string) => Promise<ScrapedChapter | null>;

type SiteLimiter = (site: string) => ReturnType<typeof pLimit>;

const SCRAPERS: Record<string, Scraper> = {
  'asurascans.com': scrapeAsuraScans,
  'kingofshojo.com': scrapeKingOfShojo,
};

/** One concurrency limiter per site, so we stay polite to each origin. */
function createSiteLimiter(): SiteLimiter {
  const limiters = new Map<string, ReturnType<typeof pLimit>>();

  return (site: string) => {
    let limiter = limiters.get(site);

    if (!limiter) {
      limiter = pLimit(SCRAPE_CONCURRENCY_PER_SITE);
      limiters.set(site, limiter);
    }

    return limiter;
  };
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

@Injectable()
export class BookmarksService {
  private readonly logger = new Logger(BookmarksService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  /**
   * Latest chapter for a bookmark: Redis cache first, then the site scraper.
   * Returns null when the site has no scraper or the scrape failed.
   * Never throws.
   */
  private async getLatestChapter(
    bookmark: { url: string; site: string; slug: string },
    limiterFor?: SiteLimiter,
  ): Promise<ScrapedChapter | null> {
    const scraper = SCRAPERS[bookmark.site];

    if (!scraper) {
      return null;
    }

    const cacheKey = scrapeCacheKey(bookmark.site, bookmark.slug);

    const cached = await this.redis
      .get<ScrapedChapter>(cacheKey)
      .catch(() => null);

    if (cached) {
      return cached;
    }

    const run = () => scraper(bookmark.url);

    const scraped = await (
      limiterFor ? limiterFor(bookmark.site)(run) : run()
    ).catch((error: unknown) => {
      this.logger.warn(
        `Chapter scrape failed for ${bookmark.url}: ${errorMessage(error)}`,
      );
      return null;
    });

    if (!scraped) {
      return null;
    }

    // Cache only what we use, not the scraper's whole payload.
    const result: ScrapedChapter = {
      number: scraped.number,
      image: scraped.image,
    };

    await this.redis
      .set(cacheKey, result, SCRAPE_CACHE_TTL_SECONDS)
      .catch((error: unknown) => {
        this.logger.warn(
          `Failed to cache scrape result: ${errorMessage(error)}`,
        );
      });

    return result;
  }

  async importFromHtml(html: string, firebaseUid: string) {
    const $ = cheerio.load(html);

    const links: { url: string; title: string }[] = [];

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

    const matched = links.flatMap((link) => {
      const match = matchBookmarkToSite(link.url);
      return match ? [{ ...link, ...match }] : [];
    });

    const deduped = Array.from(
      new Map(matched.map((bookmark) => [bookmark.url, bookmark])).values(),
    );

    // Links that aren't a supported comic page (other sites, folders, junk).
    const skipped = links.length - matched.length;

    if (deduped.length === 0) {
      return {
        imported: 0,
        skipped,
        failedScrapes: 0,
      };
    }

    const existing = await this.prisma.bookmark.findMany({
      where: {
        firebaseUid,
        url: {
          in: deduped.map((bookmark) => bookmark.url),
        },
      },
      select: {
        url: true,
        lastChapter: true,
        comicProfilePic: true,
      },
    });

    const existingByUrl = new Map(
      existing.map((bookmark) => [bookmark.url, bookmark]),
    );

    const limiterFor = createSiteLimiter();

    const withChapters = await Promise.all(
      deduped.map(async (bookmark) => {
        const previous = existingByUrl.get(bookmark.url);
        const existingChapter = previous?.lastChapter ?? null;
        const existingImage = previous?.comicProfilePic ?? null;

        const hasScraper = SCRAPERS[bookmark.site] !== undefined;
        const result = await this.getLatestChapter(bookmark, limiterFor);

        /*
         * Never move lastChapter backwards.
         */
        const lastChapter = result
          ? Math.max(result.number, existingChapter ?? result.number)
          : existingChapter;

        return {
          ...bookmark,
          lastChapter,
          comicProfilePic: result?.image ?? existingImage,
          lastCheckedAt: result ? new Date() : null,
          scrapeFailed: hasScraper && result === null,
        };
      }),
    );

    // Bound concurrent writes: an export can hold thousands of links and the
    // connection pool is small.
    const dbLimit = pLimit(DB_WRITE_CONCURRENCY);

    const results = await Promise.all(
      withChapters.map((bookmark) =>
        dbLimit(() =>
          this.prisma.bookmark.upsert({
            where: {
              firebaseUid_url: {
                firebaseUid,
                url: bookmark.url,
              },
            },

            update: {
              ...(bookmark.lastChapter !== null
                ? { lastChapter: bookmark.lastChapter }
                : {}),

              ...(bookmark.lastCheckedAt
                ? { lastCheckedAt: bookmark.lastCheckedAt }
                : {}),

              ...(bookmark.comicProfilePic
                ? { comicProfilePic: bookmark.comicProfilePic }
                : {}),
            },

            create: {
              firebaseUid,
              url: bookmark.url,
              title: bookmark.title || null,
              site: bookmark.site,
              slug: bookmark.slug,
              lastChapter: bookmark.lastChapter,
              lastCheckedAt: bookmark.lastCheckedAt,
              comicProfilePic: bookmark.comicProfilePic,
            },
          }),
        ),
      ),
    );

    return {
      imported: results.length,
      skipped,
      failedScrapes: withChapters.filter((bookmark) => bookmark.scrapeFailed)
        .length,
    };
  }

  async checkOne(id: string, firebaseUid: string) {
    /*
     * IMPORTANT:
     * Always include firebaseUid in the lookup.
     *
     * Otherwise a user could potentially check another user's
     * bookmark if they know/guess its ID.
     */
    const bookmark = await this.prisma.bookmark.findFirst({
      where: {
        id,
        firebaseUid,
      },
    });

    if (!bookmark) {
      throw new NotFoundException('Bookmark not found');
    }

    const result = await this.getLatestChapter(bookmark);

    /*
     * No scraper, or failed scrape:
     * do not modify lastChapter or lastCheckedAt.
     */
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

    /*
     * Never decrease lastChapter.
     */
    const newLastChapter = Math.max(
      bookmark.lastChapter ?? result.number,
      result.number,
    );

    const updated = await this.prisma.bookmark.update({
      where: {
        id: bookmark.id,
      },

      data: {
        lastChapter: newLastChapter,
        lastCheckedAt: new Date(),
        comicProfilePic: result.image ?? bookmark.comicProfilePic,
      },
    });

    return {
      id: updated.id,
      lastChapter: updated.lastChapter,
      hasNewChapter,
      checked: true,
    };
  }

  async batchCheck(firebaseUid: string) {
    const bookmarks = await this.prisma.bookmark.findMany({
      where: {
        firebaseUid,
      },

      select: {
        id: true,
        url: true,
        title: true,
        site: true,
        slug: true,
        lastChapter: true,
        lastCheckedAt: true,
        comicProfilePic: true,
      },
    });

    const staleBefore = new Date(Date.now() - STALE_AFTER_MINUTES * 60_000);

    const limiterFor = createSiteLimiter();
    const dbLimit = pLimit(DB_WRITE_CONCURRENCY);

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

        const result = await this.getLatestChapter(bookmark, limiterFor);

        /*
         * No scraper, or failed scrape:
         * don't update the database.
         */
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

        const newLastChapter = Math.max(
          bookmark.lastChapter ?? result.number,
          result.number,
        );

        const updated = await dbLimit(() =>
          this.prisma.bookmark.update({
            where: {
              id: bookmark.id,
            },

            data: {
              lastChapter: newLastChapter,
              lastCheckedAt: new Date(),
              comicProfilePic: result.image ?? bookmark.comicProfilePic,
            },
          }),
        );

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

      checked: results.filter((result) => result.checked).length,

      newChapters: results.filter((result) => result.hasNewChapter),

      failed: results.filter(
        (result) =>
          result.checked === false &&
          !('skippedReason' in result && result.skippedReason),
      ).length,

      skipped: results.filter(
        (result) =>
          'skippedReason' in result &&
          result.skippedReason === 'recently checked',
      ).length,
    };
  }

  async findAll(firebaseUid: string) {
    return this.prisma.bookmark.findMany({
      where: {
        firebaseUid,
      },

      orderBy: {
        updatedAt: 'desc',
      },

      select: {
        id: true,
        url: true,
        title: true,
        site: true,
        slug: true,
        comicProfilePic: true,
        lastChapter: true,
        lastCheckedAt: true,
      },
    });
  }
}
