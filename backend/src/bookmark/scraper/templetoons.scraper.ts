import axios from 'axios';
import * as cheerio from 'cheerio';
import type { ScrapedChapter, Scraper } from '../type/main.type';

const BASE_URL = 'https://templetoons.com';

/**
 * Browser-consistent headers. The site is behind Cloudflare, which expects the
 * client hints to agree; no clearance cookie is sent.
 */
const BROWSER_HEADERS = {
  accept:
    'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
  'accept-language': 'en-US,en;q=0.7',
  'cache-control': 'max-age=0',
  'sec-ch-ua': '"Chromium";v="154", "Brave";v="154", "Not A(Brand";v="99"',
  'sec-ch-ua-mobile': '?1',
  'sec-ch-ua-platform': '"iOS"',
  'sec-fetch-dest': 'document',
  'sec-fetch-mode': 'navigate',
  'sec-fetch-site': 'same-origin',
  'sec-fetch-user': '?1',
  'sec-gpc': '1',
  'upgrade-insecure-requests': '1',
  'user-agent':
    'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1',
  referer: `${BASE_URL}/`,
  priority: 'u=0, i',
};

interface ChapterCandidate {
  number: number;
  url: string;
  title?: string;
  image?: string;
  isChapterLocked?: boolean;
  date?: string;
  /** The row's `chapter-link-chapter-N` id; header CTAs do not have one. */
  elementId?: string;
}

function normalizeText(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function extractChapterNumber(href: string, text: string): number | null {
  // Support common chapter URL patterns.
  const patterns = [
    /\/chapter\/(\d+(?:\.\d+)?)(?:\/|$|\?)/i,
    /\/chapter-(\d+(?:\.\d+)?)(?:\/|$|\?)/i,
    /\/chapter_(\d+(?:\.\d+)?)(?:\/|$|\?)/i,
  ];

  for (const pattern of patterns) {
    const match = href.match(pattern);

    if (match) {
      const number = Number(match[1]);

      if (Number.isFinite(number)) {
        return number;
      }
    }
  }

  // Fallback to chapter text only when it explicitly labels a number.
  const textMatch = text.match(/\bchapter\s*(\d+(?:\.\d+)?)(?:\s|$|:|-)/i);

  if (textMatch) {
    const number = Number(textMatch[1]);

    if (Number.isFinite(number)) {
      return number;
    }
  }

  return null;
}

function detectChapterLock(
  $: cheerio.CheerioAPI,
  anchor: ReturnType<cheerio.CheerioAPI>,
): boolean | undefined {
  const text = normalizeText(anchor.text());

  // Explicit text indicating that the chapter is locked or
  // restricted to early-access/premium readers. Badge text is often glued
  // to its neighbours ("Chapter 5NewPremiumabout 6 hours ago"), so
  // "premium" is matched without word boundaries.
  if (
    /\b(?:unlock(?:s|ed)? in|early access|members only)\b/i.test(text) ||
    /premium/i.test(text) ||
    /\blocked\b/i.test(text)
  ) {
    return true;
  }

  // Check attributes and class names on the chapter link and
  // its descendants for explicit lock indicators.
  const elements = anchor.find('*').addBack();

  let explicitLock = false;
  let explicitUnlocked = false;

  elements.each((_, element) => {
    const node = $(element);

    const classes = node.attr('class') ?? '';
    const ariaLabel = node.attr('aria-label') ?? '';
    const title = node.attr('title') ?? '';
    const dataStatus =
      node.attr('data-lock-status') ?? node.attr('data-locked') ?? '';

    const description = [classes, ariaLabel, title, dataStatus].join(' ');

    if (
      /\b(locked|lock-icon|lock-badge|premium|early-access)\b/i.test(
        description,
      ) ||
      dataStatus.toLowerCase() === 'true'
    ) {
      explicitLock = true;
    }

    if (
      /\b(unlocked|free chapter|read free)\b/i.test(description) ||
      dataStatus.toLowerCase() === 'false'
    ) {
      explicitUnlocked = true;
    }
  });

  if (explicitLock) {
    return true;
  }

  if (explicitUnlocked) {
    return false;
  }

  // Every anchor reaching this point is a chapter link, and this site marks
  // paid chapters with a "Premium" badge. Their absence therefore means the
  // chapter is free, which also lets a stored lock clear once early access
  // ends.
  return false;
}

function parseChapterCandidates(
  html: string,
  pageUrl: string,
): ChapterCandidate[] {
  const $ = cheerio.load(html);
  const byUrl = new Map<string, ChapterCandidate>();

  $('a[href]').each((_, element) => {
    const anchor = $(element);
    const rawHref = anchor.attr('href');

    if (!rawHref) {
      return;
    }

    let chapterUrl: URL;

    try {
      chapterUrl = new URL(rawHref, pageUrl);
    } catch {
      return;
    }

    if (
      chapterUrl.hostname !== 'templetoons.com' &&
      chapterUrl.hostname !== 'www.templetoons.com'
    ) {
      return;
    }

    const href = chapterUrl.pathname;
    const text = normalizeText(anchor.text());
    const number = extractChapterNumber(href, text);

    if (number === null) {
      return;
    }

    const imageElement = anchor.find('img').first();
    const timeElement = anchor.find('time').first();
    const date =
      timeElement.attr('datetime') ||
      normalizeText(timeElement.text()) ||
      undefined;

    const candidate: ChapterCandidate = {
      number,
      url: chapterUrl.href,
      title: text || undefined,
      image:
        imageElement.attr('data-src') ??
        imageElement.attr('data-lazy-src') ??
        imageElement.attr('src') ??
        undefined,
      isChapterLocked: detectChapterLock($, anchor),
      elementId: anchor.attr('id'),
      date,
    };

    const existing = byUrl.get(chapterUrl.href);

    if (!existing) {
      byUrl.set(chapterUrl.href, candidate);
      return;
    }

    // The same chapter is linked more than once: a header CTA ("Latest: Ch. 5")
    // and the chapter row itself. The CTA carries no badge, so keep whichever
    // entry actually reports a lock state.
    byUrl.set(chapterUrl.href, {
      number: existing.number,
      url: existing.url,
      title: existing.title ?? candidate.title,
      image: existing.image ?? candidate.image,
      elementId: existing.elementId ?? candidate.elementId,
      date: existing.date ?? candidate.date,
      isChapterLocked:
        existing.isChapterLocked === true || candidate.isChapterLocked === true
          ? true
          : (existing.isChapterLocked ?? candidate.isChapterLocked),
    });
  });

  return [...byUrl.values()];
}

export const scrapeTempleToons: Scraper = async (
  url: string,
): Promise<ScrapedChapter | null> => {
  let parsedUrl: URL;

  try {
    parsedUrl = new URL(url);

    if (
      parsedUrl.protocol !== 'https:' ||
      !/^([a-z0-9-]+\.)*templetoons\.com$/i.test(parsedUrl.hostname) ||
      !parsedUrl.pathname.startsWith('/comic/')
    ) {
      return null;
    }
  } catch {
    return null;
  }

  try {
    // Always read the series page, even when a chapter URL was bookmarked, so
    // the result is the series' newest chapter.
    const seriesSlug = parsedUrl.pathname.match(/^\/comic\/([^/]+)/)?.[1];

    if (!seriesSlug) {
      return null;
    }

    const seriesUrl = `${BASE_URL}/comic/${encodeURIComponent(seriesSlug)}`;

    const response = await axios.get<string>(seriesUrl, {
      timeout: 12_000,
      maxRedirects: 3,
      maxContentLength: 5 * 1024 * 1024,
      responseType: 'text',
      headers: BROWSER_HEADERS,
      validateStatus: (status) => status >= 200 && status < 300,
    });

    const html = response.data;

    if (typeof html !== 'string' || !html.trim()) {
      return null;
    }

    const $ = cheerio.load(html);

    // Avoid treating an anti-bot challenge as a valid comic page.
    const pageTitle = normalizeText($('title').first().text());

    if (
      /just a moment|attention required|checking your browser|access denied/i.test(
        pageTitle,
      )
    ) {
      return null;
    }

    const title =
      normalizeText($('h1').first().text()) ||
      $('meta[property="og:title"]').attr('content')?.trim() ||
      undefined;

    const image =
      $('meta[property="og:image"]').attr('content')?.trim() || undefined;

    const chapters = parseChapterCandidates(html, seriesUrl);

    if (chapters.length === 0) {
      return null;
    }

    // The page lists chapters newest-first. Do not take the highest number:
    // some series carry old uploads with non-monotonic numbers (for example
    // 1115 alongside 126), and those must not become the "latest" chapter.
    // The header has a "Latest: Ch. N" CTA, then the newest chapter row, then
    // older rows; "Start reading" points at chapter 1 and comes first.
    const latest =
      chapters.find((chapter) => /\blatest\b/i.test(chapter.title ?? '')) ??
      chapters.find((chapter) => chapter.date) ??
      chapters.find((chapter) =>
        chapter.elementId?.startsWith('chapter-link-'),
      ) ??
      chapters[0];

    return {
      number: latest.number,
      title,
      // Prefer the page cover over a chapter thumbnail.
      image: image ?? latest.image,
      isChapterLocked: latest.isChapterLocked,
    };
  } catch {
    return null;
  }
};
