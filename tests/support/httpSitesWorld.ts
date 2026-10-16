import type { SitePage } from '../../src/application/ports/siteFetcher.js';
import type { HttpSite } from '../../src/domain/settings/types.js';
import { fakeListingExtractor } from '../fakes/fakeListingExtractor.js';
import { fakeSiteFetcher } from '../fakes/fakeSiteFetcher.js';
import { settingsWithDealerMailbox } from './dealerMailbox.js';
import { LEPARKING_BMW_M3_RESULTS, LEPARKING_BMW_M3_SEARCH } from './leparkingListings.js';
import { mailWorld } from './mailWorld.js';

export const LEPARKING_SITE: HttpSite = { id: 'k3v9x2ab', name: 'Leparking', url: LEPARKING_BMW_M3_SEARCH, enabled: true };

export const LEPARKING_PAGE: SitePage = { kind: 'page', url: LEPARKING_BMW_M3_SEARCH, html: '<html>…</html>' };

export const httpSitesWorld = (httpSites: readonly HttpSite[], pages: Readonly<Record<string, SitePage>>) => {
  const world = mailWorld([], { settings: settingsWithDealerMailbox({ httpSites }) });
  return {
    ...world,
    siteFetcher: fakeSiteFetcher(pages),
    extractor: fakeListingExtractor({
      pages: { [LEPARKING_BMW_M3_SEARCH]: { listings: LEPARKING_BMW_M3_RESULTS, method: 'structuredData' } },
    }),
  };
};
