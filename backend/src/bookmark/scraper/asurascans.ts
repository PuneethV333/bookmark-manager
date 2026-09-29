import { ChapterInfo } from './kingofshojo';
import axios from 'axios';
import * as cheerio from 'cheerio';

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
}

function extractLatestChapterFromIsland(html: string): number | null {
  const islandMatch = html.match(
    /<astro-island[^>]*component-url="\/_astro\/ChapterListReact[^"]*"[^>]*props="([^"]*)"/,
  );
  if (!islandMatch) {
    return null;
  }

  const propsJson = decodeHtmlEntities(islandMatch[1]);
  const numberMatch = propsJson.match(/"number":\[0,(\d+(?:\.\d+)?)\]/);
  if (!numberMatch) {
    return null;
  }

  const number = parseFloat(numberMatch[1]);
  return Number.isNaN(number) ? null : number;
}

/**
 * Fallback only — matches a static <a href=".../chapter/N"> if the site
 * ever server-renders the chapter list directly. Currently this will only
 * ever find the "First Chapter" button (chapter 1), so it's a last resort,
 * not the primary path.
 */
function extractLatestChapterFromStaticLinks(
  html: string,
  slug: string,
): { number: number; href: string } | null {
  const $ = cheerio.load(html);
  const chapters: { number: number; href: string }[] = [];

  $(`a[href*="/comics/${slug}/chapter/"]`).each((_, el) => {
    const href = $(el).attr('href');
    if (!href) return;

    const numMatch = href.match(/\/chapter\/(\d+(?:\.\d+)?)/);
    if (numMatch) {
      chapters.push({ number: parseFloat(numMatch[1]), href });
    }
  });

  if (chapters.length === 0) {
    return null;
  }

  return chapters.reduce((max, ch) => (ch.number > max.number ? ch : max));
}

export const scrapeAsuraScans = async (
  url: string,
): Promise<ChapterInfo | null> => {
  if (!url) {
    return null;
  }

  let html: string;
  try {
    const response = await axios.get<string>(url, {
      timeout: 10_000,
      maxRedirects: 3,
      maxContentLength: 5 * 1024 * 1024,
      responseType: 'text',
    });
    html = response.data;
  } catch {
    return null;
  }

  const slugMatch = url.match(/\/comics\/([^/?]+)/);
  const slug = slugMatch?.[1];
  if (!slug) {
    return null;
  }

  const $ = cheerio.load(html);
  const image = $('meta[property="og:image"]').attr('content');

  const islandNumber = extractLatestChapterFromIsland(html);
  if (islandNumber !== null) {
    return {
      number: islandNumber,
      // The island's props don't give us a per-chapter URL cheaply here;
      // point at the series page rather than fabricate a wrong link.
      url,
      date: '',
      image,
    };
  }

  // Fallback path — see extractLatestChapterFromStaticLinks's caveat above.
  const fallback = extractLatestChapterFromStaticLinks(html, slug);
  if (!fallback) {
    return null;
  }

  return {
    number: fallback.number,
    url: new URL(fallback.href, url).href,
    date: '',
    image,
  };
};
