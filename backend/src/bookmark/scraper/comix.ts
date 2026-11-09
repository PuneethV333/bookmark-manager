import axios from 'axios';
import * as cheerio from 'cheerio';
import type { ScrapedChapter, Scraper } from '../type/main.type';

const BASE_URL = 'https://comix.to';

/**
 * Browser-consistent header set. comix.to is served through Cloudflare; most
 * requests get the real page, but a challenge can appear, and the clearance
 * cookie is only accepted when these headers agree with the browser that
 * earned it (same user agent and client hints).
 */
const BROWSER_HEADERS = {
  accept:
    'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
  'accept-language': 'en-US,en;q=0.7',
  'cache-control': 'max-age=0',
  'sec-ch-ua': '"Chromium";v="154", "Brave";v="154", "Not A(Brand";v="99"',
  'sec-ch-ua-arch': '"x86"',
  'sec-ch-ua-bitness': '"64"',
  'sec-ch-ua-full-version-list':
    '"Chromium";v="154.0.0.0", "Brave";v="154.0.0.0", "Not A(Brand";v="99.0.0.0"',
  'sec-ch-ua-mobile': '?0',
  'sec-ch-ua-model': '""',
  'sec-ch-ua-platform': '"Linux"',
  'sec-ch-ua-platform-version': '""',
  'sec-fetch-dest': 'document',
  'sec-fetch-mode': 'navigate',
  'sec-fetch-site': 'same-origin',
  'sec-fetch-user': '?1',
  'sec-gpc': '1',
  'upgrade-insecure-requests': '1',
  'user-agent':
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Safari/537.36',
  referer: `${BASE_URL}/`,
  priority: 'u=0, i',
};

const CHALLENGE_TITLE =
  /just a moment|attention required|checking your browser|access denied/i;

let failureLogged = false;

/**
 * COMIX_COOKIE may hold either the bare cf_clearance value or a complete
 * `cf_clearance=...` cookie string.
 */
function resolveCloudflareCookie(): string | undefined {
  const raw = process.env.COMIX_COOKIE?.trim();

  if (!raw) {
    return undefined;
  }

  const value = raw.startsWith('cf_clearance=')
    ? raw.slice('cf_clearance='.length)
    : raw;

  // A real clearance value is long. Short values are placeholders such as the
  // variable name copied from .env.example, which would only guarantee a 403.
  if (value.length < 40) {
    return undefined;
  }

  return `cf_clearance=${value}`;
}

interface ComixDetail {
  hid?: unknown;
  title?: unknown;
  latestChapter?: unknown;
  latestChapterUrl?: unknown;
  hasChapters?: unknown;
  poster?: { medium?: unknown; large?: unknown } | null;
}

function isDetailQueryKey(key: string): boolean {
  try {
    const parsed: unknown = JSON.parse(key);

    return (
      Array.isArray(parsed) && parsed[0] === 'manga' && parsed[1] === 'detail'
    );
  } catch {
    return false;
  }
}

function toAbsoluteUrl(value: unknown): string | undefined {
  if (typeof value !== 'string' || !value.trim()) {
    return undefined;
  }

  try {
    return new URL(value, BASE_URL).href;
  } catch {
    return undefined;
  }
}

/**
 * `latestChapter` is normally a number. Fall back to a numeric string or the
 * chapter number embedded in `latestChapterUrl` so a payload markup change
 * does not discard an otherwise usable page.
 */
function parseLatestChapter(detail: ComixDetail): number | null {
  if (
    typeof detail.latestChapter === 'number' &&
    Number.isFinite(detail.latestChapter)
  ) {
    return detail.latestChapter;
  }

  const fromString =
    typeof detail.latestChapter === 'string'
      ? Number(detail.latestChapter)
      : Number.NaN;

  if (Number.isFinite(fromString)) {
    return fromString;
  }

  if (typeof detail.latestChapterUrl === 'string') {
    const match = detail.latestChapterUrl.match(/chapter-(\d+(?:\.\d+)?)/i);
    const fromUrl = match ? Number(match[1]) : Number.NaN;

    if (Number.isFinite(fromUrl)) {
      return fromUrl;
    }
  }

  return null;
}

/**
 * The series page is a client-rendered app, so the chapter list is not in the
 * markup. The server embeds the page's data as JSON in
 * <script id="initial-data">; the `["manga","detail",<hid>]` query holds the
 * series title, cover and latest chapter number.
 */
export function parseComixHtml(
  html: string,
  expectedHid?: string,
): ScrapedChapter | null {
  const $ = cheerio.load(html);
  const raw = $('script#initial-data').first().html();

  if (!raw) {
    return null;
  }

  let data: unknown;

  try {
    data = JSON.parse(raw);
  } catch {
    return null;
  }

  const queries = (data as { queries?: Record<string, unknown> } | null)
    ?.queries;

  if (!queries || typeof queries !== 'object') {
    return null;
  }

  for (const [key, value] of Object.entries(queries)) {
    if (!isDetailQueryKey(key) || !value || typeof value !== 'object') {
      continue;
    }

    const detail = value as ComixDetail;

    // Never report another series' chapter if the page layout changes.
    if (expectedHid && detail.hid !== expectedHid) {
      continue;
    }

    if (detail.hasChapters === false) {
      return null;
    }

    const number = parseLatestChapter(detail);

    if (number === null) {
      return null;
    }

    const title =
      typeof detail.title === 'string' && detail.title.trim()
        ? detail.title.trim()
        : undefined;

    return {
      number,
      title,
      // The card-sized variant is what the site itself renders, and it is an
      // order of magnitude smaller than `large`.
      image: toAbsoluteUrl(detail.poster?.medium ?? detail.poster?.large),
      // The detail payload has no per-chapter lock flag, so lock status is
      // unknown rather than false.
    };
  }

  return null;
}

interface PageResponse {
  status: number;
  html: string;
}

async function fetchSeriesPage(
  url: string,
  cookie?: string,
): Promise<PageResponse> {
  const response = await axios.get<string>(url, {
    timeout: 12_000,
    maxRedirects: 3,
    maxContentLength: 5 * 1024 * 1024,
    responseType: 'text',
    headers: cookie ? { ...BROWSER_HEADERS, cookie } : BROWSER_HEADERS,
    // Inspect the status ourselves: a challenge is a 403/503, not an error.
    validateStatus: () => true,
  });

  return {
    status: response.status,
    html: typeof response.data === 'string' ? response.data : '',
  };
}

function looksLikeChallenge({ status, html }: PageResponse): boolean {
  if (status === 403 || status === 503) {
    return true;
  }

  const title = cheerio.load(html)('title').first().text();

  return CHALLENGE_TITLE.test(title);
}

/** Logs the first failure per process; the library would otherwise repeat it. */
function logFailure(response: PageResponse | null, reason: string): void {
  if (failureLogged) {
    return;
  }

  failureLogged = true;

  const status = response ? `status ${response.status}` : 'no response';
  const challenge =
    response && looksLikeChallenge(response) ? ', Cloudflare challenge' : '';

  console.warn(
    `[Comix scraper] Could not read the series page (${status}${challenge}). ${reason}`,
  );
}

export const scrapeComix: Scraper = async (
  url: string,
): Promise<ScrapedChapter | null> => {
  let slug: string;

  try {
    const parsedUrl = new URL(url);

    if (
      parsedUrl.protocol !== 'https:' ||
      !/^(www\.)?comix\.to$/i.test(parsedUrl.hostname)
    ) {
      return null;
    }

    // Accept chapter URLs too (/title/<hid>-<slug>/<id>-chapter-N) and scrape
    // the series they belong to.
    const match = parsedUrl.pathname.match(/^\/title\/([^/]+)/i);

    if (!match) {
      return null;
    }

    slug = decodeURIComponent(match[1]);
  } catch {
    return null;
  }

  // Series slugs are `<hid>-<title-words>`; the hid identifies the series.
  const hid = slug.split('-')[0];
  const seriesUrl = `${BASE_URL}/title/${encodeURIComponent(slug)}`;

  try {
    // Plain request first: the cookie is only needed when Cloudflare
    // challenges the request.
    const first = await fetchSeriesPage(seriesUrl);

    if (first.status < 400) {
      const parsed = parseComixHtml(first.html, hid);

      if (parsed) {
        return parsed;
      }
    }

    const cookie = resolveCloudflareCookie();

    if (!cookie) {
      logFailure(
        first,
        'no usable COMIX_COOKIE is configured; copy a fresh cf_clearance value from a browser that has passed the challenge.',
      );
      return null;
    }

    // Retry with the cookie even when the first response did not look like a
    // challenge: a 200 page without initial-data is just as unusable.
    const second = await fetchSeriesPage(seriesUrl, cookie);

    if (second.status < 400) {
      const parsed = parseComixHtml(second.html, hid);

      if (parsed) {
        return parsed;
      }
    }

    logFailure(
      second,
      'COMIX_COOKIE may be expired or bound to a different IP or User-Agent.',
    );
    return null;
  } catch (error) {
    logFailure(
      null,
      `request failed: ${error instanceof Error ? error.message : String(error)}`,
    );
    return null;
  }
};
