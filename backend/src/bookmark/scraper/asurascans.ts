import axios from 'axios';
import * as cheerio from 'cheerio';
import { ChapterInfo } from '../type/main.type';

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&quot;/g, '"')
    .replace(/&#34;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
}

const CHALLENGE_TITLE =
  /just a moment|attention required|checking your browser|access denied/i;

/**
 * Cloudflare now rejects requests that send a browser user agent without the
 * matching client hints (a bare curl or a UA-only request gets a 403
 * "Just a moment" page). These are the headers the site's own navigation uses.
 */
const BROWSER_HEADERS = {
  accept:
    'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
  'accept-language': 'en-US,en;q=0.5',
  'cache-control': 'max-age=0',
  'sec-ch-ua': '"Chromium";v="154", "Brave";v="154", "Not A(Brand";v="99"',
  'sec-ch-ua-mobile': '?0',
  'sec-ch-ua-platform': '"Linux"',
  'sec-fetch-dest': 'document',
  'sec-fetch-mode': 'navigate',
  'sec-fetch-site': 'none',
  'sec-fetch-user': '?1',
  'sec-gpc': '1',
  'upgrade-insecure-requests': '1',
  'user-agent':
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Safari/537.36',
};

let failureLogged = false;

/**
 * ASURA_COOKIE may hold either the bare cf_clearance value or a complete
 * `cf_clearance=...` cookie string.
 */
function resolveCloudflareCookie(): string | undefined {
  const raw = process.env.ASURA_COOKIE?.trim();

  if (!raw) {
    return undefined;
  }

  const value = raw.startsWith('cf_clearance=')
    ? raw.slice('cf_clearance='.length)
    : raw;

  // Placeholders such as the variable name copied from .env.example would
  // only guarantee a 403.
  if (value.length < 40) {
    return undefined;
  }

  return `cf_clearance=${value}`;
}

interface PageResponse {
  status: number;
  html: string;
  finalUrl: string;
}

async function fetchSeriesPage(
  url: string,
  cookie?: string,
): Promise<PageResponse> {
  const response = await axios.get<string>(url, {
    timeout: 10_000,
    maxRedirects: 5,
    maxContentLength: 5 * 1024 * 1024,
    responseType: 'text',
    headers: cookie ? { ...BROWSER_HEADERS, cookie } : BROWSER_HEADERS,
    // Inspect the status ourselves: a challenge is a 403, not an error.
    validateStatus: () => true,
  });

  const request = response.request as
    { res?: { responseUrl?: string } } | undefined;

  return {
    status: response.status,
    html: typeof response.data === 'string' ? response.data : '',
    finalUrl: request?.res?.responseUrl ?? url,
  };
}

function looksLikeChallenge({ status, html }: PageResponse): boolean {
  if (status === 403 || status === 503) {
    return true;
  }

  // Avoid a full cheerio parse just to read the title.
  const title = html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1] ?? '';

  return CHALLENGE_TITLE.test(title);
}

/** Logs the first failure per process; checks would otherwise repeat it. */
function logFailure(response: PageResponse | null, reason: string): void {
  if (failureLogged) {
    return;
  }

  failureLogged = true;

  const status = response ? `status ${response.status}` : 'no response';
  const challenge =
    response && looksLikeChallenge(response) ? ', Cloudflare challenge' : '';

  console.warn(
    `[Asura scraper] Could not read the series page (${status}${challenge}). ${reason}`,
  );
}

interface EmbeddedChapter {
  number: number;
  isChapterLocked: boolean;
  slug?: string;
  publishedAt?: string;
}

/**
 * Extract chapters from the serialized ChapterListReact Astro island.
 *
 * The serialized props use Astro's [type, value] representation,
 * e.g. "number":[0,99] and "is_premium":[0,true].
 */
function extractLatestChapterFromIsland(html: string): EmbeddedChapter | null {
  const islandRegex =
    /<astro-island\b(?=[^>]*component-url="[^"]*ChapterListReact)[^>]*\bprops="([^"]*)"[^>]*>/s;

  const match = html.match(islandRegex);

  if (!match?.[1]) {
    return null;
  }

  const props = decodeHtmlEntities(match[1]);

  // Match complete serialized chapter objects, rather than matching
  // number and is_premium independently across different chapters.
  const chapters: EmbeddedChapter[] = [];

  const objectRegex = /\[0,\{([\s\S]*?)\}\]/g;

  for (const objectMatch of props.matchAll(objectRegex)) {
    const object = objectMatch[1];

    const numberMatch = object.match(/"number"\s*:\s*\[0,\s*(\d+(?:\.\d+)?)\]/);

    if (!numberMatch) {
      continue;
    }

    const premiumMatch = object.match(
      /"is_premium"\s*:\s*\[0,\s*(true|false)\]/,
    );

    const slugMatch = object.match(/"slug"\s*:\s*\[0,\s*"([^"]*)"\]/);

    const publishedAtMatch = object.match(
      /"published_at"\s*:\s*\[0,\s*"([^"]*)"\]/,
    );

    // Do not silently claim a chapter is unlocked when the source
    // does not expose its premium status.
    if (!premiumMatch) {
      continue;
    }

    chapters.push({
      number: Number(numberMatch[1]),
      isChapterLocked: premiumMatch[1] === 'true',
      slug: slugMatch?.[1],
      publishedAt: publishedAtMatch?.[1],
    });
  }

  if (chapters.length === 0) {
    return null;
  }

  return chapters.reduce((latest, chapter) =>
    chapter.number > latest.number ? chapter : latest,
  );
}

/**
 * Fallback for pages that server-render chapter links directly.
 */
function extractLatestChapterFromStaticLinks(
  html: string,
  slug: string,
): EmbeddedChapter | null {
  const $ = cheerio.load(html);

  const chapters: EmbeddedChapter[] = [];

  $(`a[href*="/comics/${slug}/chapter/"]`).each((_, element) => {
    const anchor = $(element);
    const href = anchor.attr('href');

    if (!href) {
      return;
    }

    const numberMatch = href.match(/\/chapter\/(\d+(?:\.\d+)?)(?:\/|$|\?)/);

    if (!numberMatch) {
      return;
    }

    const chapterNumber = Number(numberMatch[1]);
    const containerText = anchor.text().trim();

    // Static links alone do not reliably establish premium status.
    // Do not mark the chapter as unlocked unless its status is known.
    const premiumIndicator =
      anchor.find('[class*="amber"], [class*="premium"]').length > 0 ||
      /unlock(?:s|ed)?\s+in|early access/i.test(containerText);

    chapters.push({
      number: chapterNumber,
      isChapterLocked: premiumIndicator,
      slug: href,
    });
  });

  if (chapters.length === 0) {
    return null;
  }

  return chapters.reduce((latest, chapter) =>
    chapter.number > latest.number ? chapter : latest,
  );
}

export const scrapeAsuraScans = async (
  url: string,
): Promise<ChapterInfo | null> => {
  if (!url) {
    return null;
  }

  let parsedUrl: URL;

  try {
    parsedUrl = new URL(url);

    if (
      parsedUrl.protocol !== 'https:' ||
      !/(^|\.)asurascans\.com$/i.test(parsedUrl.hostname)
    ) {
      return null;
    }
  } catch {
    return null;
  }

  let page: PageResponse;

  try {
    page = await fetchSeriesPage(parsedUrl.href);
  } catch (error) {
    logFailure(
      null,
      `request failed: ${error instanceof Error ? error.message : String(error)}`,
    );
    return null;
  }

  if (looksLikeChallenge(page) || page.status >= 400) {
    const cookie = resolveCloudflareCookie();

    if (cookie) {
      try {
        page = await fetchSeriesPage(parsedUrl.href, cookie);
      } catch {
        // Keep the first response for the failure log below.
      }
    }

    if (looksLikeChallenge(page) || page.status >= 400) {
      logFailure(
        page,
        cookie
          ? 'ASURA_COOKIE may be expired or bound to a different IP or User-Agent.'
          : 'no usable ASURA_COOKIE is configured.',
      );
      return null;
    }
  }

  const html = page.html;
  const $ = cheerio.load(html);

  // The series hash rotates on site updates (...-bd5bdaf8 became
  // ...-f212c582) and old URLs redirect. Prefer the canonical slug so chapter
  // links point at the current URL instead of the stale hash.
  const canonicalMatch = $('link[rel="canonical"]')
    .attr('href')
    ?.match(/\/comics\/([^/?#]+)/);
  let finalSlug: string | undefined;

  try {
    finalSlug = new URL(page.finalUrl).pathname.match(
      /\/comics\/([^/?#]+)/,
    )?.[1];
  } catch {
    finalSlug = undefined;
  }

  const slugMatch = parsedUrl.pathname.match(/\/comics\/([^/]+)/);
  const slug = canonicalMatch?.[1] ?? finalSlug ?? slugMatch?.[1];

  if (!slug) {
    return null;
  }

  const title = $('h1').first().text().trim() || undefined;

  const image = $('meta[property="og:image"]').attr('content') || undefined;

  // Prefer embedded data because it contains is_premium.
  const embeddedChapter = extractLatestChapterFromIsland(html);

  if (embeddedChapter) {
    const chapterUrl = embeddedChapter.slug
      ? new URL(
          `/comics/${slug}/chapter/${embeddedChapter.number}`,
          parsedUrl.origin,
        ).href
      : parsedUrl.href;

    return {
      number: embeddedChapter.number,
      url: chapterUrl,
      date: embeddedChapter.publishedAt ?? '',
      image,
      title,
      isChapterLocked: embeddedChapter.isChapterLocked,
    };
  }

  // Fall back to static links when embedded data is unavailable.
  const fallback = extractLatestChapterFromStaticLinks(html, slug);

  if (!fallback) {
    return null;
  }

  return {
    number: fallback.number,
    url: new URL(`/comics/${slug}/chapter/${fallback.number}`, parsedUrl.origin)
      .href,
    date: fallback.publishedAt ?? '',
    image,
    title,
    isChapterLocked: fallback.isChapterLocked,
  };
};
