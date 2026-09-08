/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { Injectable, Logger } from '@nestjs/common';
import * as cheerio from 'cheerio';
import pLimit from 'p-limit';
import { PrismaService } from '../prisma/prisma.service';
import { SITE_MATCHERS } from './constants/site-matchers';
import { scrapeAsuraScans } from './scraper/asurascans';
import { scrapeKingOfShojo } from './scraper/kingofshojo';

function isMatchingDomain(hostname: string, domain: string): boolean {
  return hostname === domain || hostname.endsWith(`.${domain}`);
}

function matchBookmarkToSite(url: string) {
  try {
    const hostname = new URL(url).hostname.replace(/^www\./, '');
    for (const [domain, extractSlug] of Object.entries(SITE_MATCHERS)) {
      if (isMatchingDomain(hostname, domain)) {
        const slug = extractSlug(url);
        if (slug) return { site: domain, slug };
      }
    }
  } catch {
    return null;
  }
  return null;
}

const SCRAPERS: Record<
  string,
  (url: string) => Promise<{ number: number } | null>
> = {
  'asurascans.com': scrapeAsuraScans,
  'kingofshojo.com': scrapeKingOfShojo,
};

@Injectable()
export class BookmarksService {
  private readonly logger = new Logger(BookmarksService.name);

  constructor(private readonly prisma: PrismaService) {}

  async importFromHtml(html: string, userId: string) {
    const $ = cheerio.load(html);
    const links: { url: string; title: string }[] = [];

    $('a').each((_, el) => {
      const href = $(el).attr('href');
      if (href) {
        links.push({ url: href, title: $(el).text().trim() });
      }
    });

    const matched = links
      .map((link) => ({ ...link, ...matchBookmarkToSite(link.url) }))
      .filter(
        (b): b is { url: string; title: string; site: string; slug: string } =>
          !!b.site,
      );

    const deduped = Array.from(
      new Map(matched.map((b) => [b.url, b])).values(),
    );
    const skipped = links.length - deduped.length;

    // Cap concurrent requests PER SITE, not globally — importing 30 Asura bookmarks
    // shouldn't fire 30 simultaneous requests at Asura, but different sites can run in parallel
    const limiters = new Map<string, ReturnType<typeof pLimit>>();
    const limiterFor = (site: string) => {
      if (!limiters.has(site)) limiters.set(site, pLimit(3));
      return limiters.get(site)!;
    };

    const withChapters = await Promise.all(
      deduped.map(async (b) => {
        const scraper = SCRAPERS[b.site];
        if (!scraper) {
          return { ...b, lastChapter: null, lastCheckedAt: null };
        }

        const limit = limiterFor(b.site);
        const result = await limit(() => scraper(b.url)).catch((err) => {
          this.logger.warn(
            `Chapter scrape failed for ${b.url}: ${err.message}`,
          );
          return null;
        });

        return {
          ...b,
          lastChapter: result?.number ?? null,
          // only stamp lastCheckedAt on a SUCCESSFUL scrape — leaving it null on
          // failure means this bookmark gets retried on the next check pass,
          // instead of looking "checked" when it actually failed
          lastCheckedAt: result ? new Date() : null,
        };
      }),
    );

    const results = await this.prisma.$transaction(
      withChapters.map((b) =>
        this.prisma.bookmark.upsert({
          where: { userId_url: { userId, url: b.url } },
          update: {}, // keep existing lastChapter/isRead untouched on re-import
          create: {
            userId,
            url: b.url,
            title: b.title || null,
            site: b.site,
            slug: b.slug,
            lastChapter: b.lastChapter,
            lastCheckedAt: b.lastCheckedAt,
          },
        }),
      ),
    );

    const failedScrapes = withChapters.filter(
      (b) => b.lastChapter === null,
    ).length;

    return { imported: results.length, skipped, failedScrapes };
  }
}
