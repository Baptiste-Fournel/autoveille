import type { FetchedPage, PageReading } from '../../application/ports/listingExtractor.js';
import { prettyHost, withoutWww } from '../../domain/sites/listingUrl.js';
import type { RawListing } from '../../domain/vehicle/types.js';
import { absoluteLinks } from './absoluteLinks.js';
import { htmlAlertListings } from './htmlAlertListings.js';
import { jsonLdListings } from './jsonLdListings.js';

const hostOf = (url: string): string | undefined => (URL.canParse(url) ? withoutWww(new URL(url).hostname) : undefined);

const withSiteLabel = (listings: readonly RawListing[], hostname: string): readonly RawListing[] =>
  listings.map((listing) => (listing.siteLabel ? listing : { ...listing, siteLabel: prettyHost(hostname) }));

export const sitePageListings = (page: FetchedPage, maxYear: number): PageReading => {
  const { hostname } = new URL(page.url);
  const structured = jsonLdListings(page.html, page.url, maxYear);
  if (structured.length > 0) {
    return { listings: withSiteLabel(structured, hostname), method: 'structuredData' };
  }
  const pageHost = withoutWww(hostname);
  const linked = htmlAlertListings(absoluteLinks(page.html, page.url), { resolvedLinks: new Map(), maxYear }).listings.filter(
    (listing) => hostOf(listing.url) === pageHost,
  );
  return { listings: withSiteLabel(linked, hostname), method: 'links' };
};
