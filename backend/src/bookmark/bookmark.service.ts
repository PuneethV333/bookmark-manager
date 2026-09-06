import { Injectable } from '@nestjs/common';
import * as cheerio from 'cheerio';
import { PrismaService } from '../prisma/prisma.service';

const SITE_MATCHERS: Record<string, (url: string) => string | undefined> = {
  'asurascan.com': (url) => url.match(/\/manga\/([^/]+)/)?.[1],
  'kingofshojo.com': (url) => url.match(/\/manga\/([^/]+)/)?.[1],
  // ...rest of your sites
};

function matchBookmarkToSite(url: string) {
  try {
    const hostname = new URL(url).hostname.replace('www.', '');
    for (const [domain, extractSlug] of Object.entries(SITE_MATCHERS)) {
      if (hostname.includes(domain)) {
        const slug = extractSlug(url);
        if (slug) return { site: domain, slug };
      }
    }
  } catch {
    return null;
  }
  return null;
}

@Injectable()
export class BookmarksService {
  constructor(private readonly prisma: PrismaService) {}

  async importFromHtml(html: string, userId: string) {
    const $ = cheerio.load(html);
    const urls: string[] = [];

    $('a').each((_, el) => {
      const href = $(el).attr('href');
      if (href) urls.push(href);
    });

    const matched = urls
      .map((url) => ({ url, ...matchBookmarkToSite(url) }))
      .filter(
        (b): b is { url: string; site: string; slug: string } => !!b.site,
      );

    const skipped = urls.length - matched.length;

    const results = await this.prisma.$transaction(
      matched.map((b) =>
        this.prisma.bookmark.upsert({
          where: { userId_url: { userId, url: b.url } },
          update: {},
          create: { userId, url: b.url, site: b.site, slug: b.slug },
        }),
      ),
    );

    return { imported: results.length, skipped };
  }
}
