/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import axios from 'axios';
import * as cheerio from 'cheerio';

export interface ChapterInfo {
  number: number;
  url: string | undefined;
  date: string;
}

export const scrapeKingOfShojo = async (
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

  const chapters = $('#chapterlist li')
    .map((_, el) => ({
      number: Number($(el).attr('data-num')),
      url: $(el).find('a').attr('href'),
      date: $(el).find('.chapterdate').text().trim(),
    }))
    .get()
    .filter((ch) => !Number.isNaN(ch.number));

  if (chapters.length === 0) {
    return null;
  }

  const latestChapter = chapters.reduce((latest, chapter) =>
    chapter.number > latest.number ? chapter : latest,
  );

  return latestChapter;
};
