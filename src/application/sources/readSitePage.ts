import {
  ANTI_BOT_PAGE,
  INVALID_SITE_ADDRESS,
  listingsReadText,
  READ_FROM_LINKS,
  READ_FROM_STRUCTURED_DATA,
  ROBOTS_DISALLOW_PAGE,
  siteRefusedText,
  siteUnreachableText,
  unexpectedStatusText,
} from '../../domain/presentation/httpSites.js';
import type { RawListing } from '../../domain/vehicle/types.js';
import type { ListingExtractor, PageReadingMethod } from '../ports/listingExtractor.js';
import type { SiteFetcher, SitePage } from '../ports/siteFetcher.js';

export interface SiteReading {
  readonly ok: boolean;
  readonly detail: string;
  readonly listings: readonly RawListing[];
}

export interface ReadSitePageDependencies {
  readonly siteFetcher: SiteFetcher;
  readonly extractor: ListingExtractor;
}

type UnreadablePage = Exclude<SitePage, { readonly kind: 'page' }>;

const unreadablePageText = (page: UnreadablePage): string => {
  switch (page.kind) {
    case 'invalidAddress':
      return INVALID_SITE_ADDRESS;
    case 'disallowedByRobots':
      return ROBOTS_DISALLOW_PAGE;
    case 'refused':
      return siteRefusedText(page.status);
    case 'unexpectedStatus':
      return unexpectedStatusText(page.status);
    case 'antiBotPage':
      return ANTI_BOT_PAGE;
    case 'unreachable':
      return siteUnreachableText(page.message);
  }
};

const READING_METHOD_TEXTS: Readonly<Record<PageReadingMethod, string>> = {
  structuredData: READ_FROM_STRUCTURED_DATA,
  links: READ_FROM_LINKS,
};

export const readSitePage = async ({ siteFetcher, extractor }: ReadSitePageDependencies, url: string): Promise<SiteReading> => {
  const page = await siteFetcher.fetchPage(url);
  if (page.kind !== 'page') {
    return { ok: false, detail: unreadablePageText(page), listings: [] };
  }
  const { listings, method } = extractor.listingsFromPage({ url: page.url, html: page.html });
  return { ok: true, detail: listingsReadText(listings.length, READING_METHOD_TEXTS[method]), listings };
};
