import { scrapeAsuraScans } from '../scraper/asurascans';
import { scrapeComix } from '../scraper/comix';
import { scrapeKingOfShojo } from '../scraper/kingofshojo';
import { scrapeLustToon } from '../scraper/lustoon';
import { scrapeTempleToons } from '../scraper/templetoons.scraper';
import { scrapeWeebCentral } from '../scraper/weebCentral';
import { Scraper } from '../type/main.type';

export const SCRAPERS: Record<string, Scraper> = {
  'asurascans.com': scrapeAsuraScans,
  'kingofshojo.com': scrapeKingOfShojo,
  'weebcentral.com': scrapeWeebCentral,
  'templetoons.com': scrapeTempleToons,
  'lustoon.com': scrapeLustToon,
  'comix.to': scrapeComix,
};
