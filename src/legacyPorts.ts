import type { IngestDependencies } from './application/ingest/ingestListing.js';
import type { NotificationDependencies } from './application/notifications/sendToChannels.js';
import type { Geocoder } from './application/ports/geocoder.js';
import type { ListingExtractor } from './application/ports/listingExtractor.js';
import type { Logger } from './application/ports/logger.js';
import type { MailboxReader } from './application/ports/mailboxReader.js';
import type { Random } from './application/ports/random.js';
import type { RedirectResolver } from './application/ports/redirectResolver.js';
import type { SiteFetcher } from './application/ports/siteFetcher.js';
import type { Store } from './db.js';
import { legacyGeocoder, storeGeoCache } from './legacyGeocoder.js';
import { legacyListingExtractor } from './legacyListingExtractor.js';
import { imapMailboxReader } from './sources/email/imap.js';
import { httpSiteFetcher } from './sources/http.js';
import { resolveRedirect } from './sources/sites.js';
import { type StoreRepositories, storeRepositories } from './storeRepositories.js';
import { systemClock, systemRandom } from './systemPorts.js';

export type Notifications = Pick<NotificationDependencies, 'channel' | 'address'>;

export type IngestPorts = IngestDependencies & StoreRepositories;

export interface LegacyPorts extends IngestPorts {
  readonly random: Random;
  readonly logger: Logger;
  readonly zoneGeocoder: Geocoder;
  readonly mailboxReader: MailboxReader;
  readonly extractor: ListingExtractor;
  readonly redirectResolver: RedirectResolver;
  readonly siteFetcher: SiteFetcher;
}

export const ingestPorts = (store: Store, notifications: Notifications): IngestPorts => ({
  ...storeRepositories(store),
  ...notifications,
  geocoder: legacyGeocoder(storeGeoCache(store)),
  clock: systemClock,
});

export const legacyPorts = (store: Store, notifications: Notifications, logger: Logger): LegacyPorts => ({
  ...ingestPorts(store, notifications),
  random: systemRandom,
  logger,
  zoneGeocoder: legacyGeocoder(),
  mailboxReader: imapMailboxReader,
  extractor: legacyListingExtractor,
  redirectResolver: { resolve: (href) => resolveRedirect(href) },
  siteFetcher: httpSiteFetcher(),
});
