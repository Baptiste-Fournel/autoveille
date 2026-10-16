import type { Clock } from '../../application/ports/clock.js';
import type { ListingExtractor } from '../../application/ports/listingExtractor.js';
import { maxPlausibleYear } from '../../domain/parsing/year.js';
import { yearOf } from '../../domain/time/yearOf.js';
import { alertEmailListings } from './alertEmailListings.js';
import { decodeEmail } from './mimeEmail.js';
import { sitePageListings } from './sitePageListings.js';
import { visibleContent } from './visibleContent.js';

export const cheerioListingExtractor = (clock: Clock): ListingExtractor => {
  const maxYear = (): number => maxPlausibleYear(yearOf(clock.now()));
  return {
    readEmail: decodeEmail,
    listingsFromEmail: (email, resolvedLinks) => alertEmailListings(email, resolvedLinks, maxYear()),
    visibleContent,
    listingsFromPage: (page) => sitePageListings(page, maxYear()),
  };
};
