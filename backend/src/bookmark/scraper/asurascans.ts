/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { ChapterInfo } from './kingofshojo';
import axios from 'axios';
import * as cheerio from 'cheerio';

export const scrapeAsuraScans = async (
  url: string,
): Promise<ChapterInfo | null> => {
  if (!url) {
    return null;
  }

  let html: string;
  try {
    const response = await axios.get(url, { timeout: 10_000 });
    html = response.data;
  } catch {
    return null;
  }

  const $ = cheerio.load(html);

  const slugMatch = url.match(/\/comics\/([^/?]+)/);
  const slug = slugMatch?.[1];
  if (!slug) {
    return null;
  }

  const chapters: { number: number; href: string }[] = [];

  $(`a[href*="/comics/${slug}/chapter/"]`).each((_, el) => {
    const href = $(el).attr('href');
    if (!href) return;

    // Number comes from the URL path itself — more reliable than link text,
    // which can include extra content like a relative date ("1 day ago")
    const numMatch = href.match(/\/chapter\/(\d+(?:\.\d+)?)/);
    if (numMatch) {
      chapters.push({ number: parseFloat(numMatch[1]), href });
    }
  });

  if (chapters.length === 0) {
    return null;
  }

  // Take the max explicitly rather than relying on DOM/document order
  const latest = chapters.reduce((max, ch) =>
    ch.number > max.number ? ch : max,
  );

  return {
    number: latest.number,
    url: new URL(latest.href, url).href,
    date: '', // not extracted here — add a date selector if you need it displayed
  };
};
