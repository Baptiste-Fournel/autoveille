import type { LatLon } from '../../src/domain/geo/distance.js';
import type { VehicleLocation } from '../../src/domain/ingest/location.js';
import { fingerprint } from '../../src/domain/vehicle/identity.js';
import type { Listing, RawListing, Vehicle } from '../../src/domain/vehicle/types.js';

export const FIRST_READ_AT = '2026-10-08T09:12:00.000Z';

export const LEBONCOIN_911_TITLE = 'Porsche 911 Carrera S 2015 42 000 km 89 900 €';

const LEBONCOIN_911_ID = '2811001234';

export const PESSAC_POSITION: LatLon = { lat: 44.8067, lon: -0.6311 };

export const PESSAC: VehicleLocation = { ...PESSAC_POSITION, distanceKm: 5.36 };

export const leboncoinListing = (title: string, fields: Partial<RawListing> = {}): RawListing => ({
  site: 'leboncoin',
  siteLabel: 'Leboncoin',
  externalId: LEBONCOIN_911_ID,
  url: `https://www.leboncoin.fr/ad/voitures/${LEBONCOIN_911_ID}`,
  title,
  city: 'Pessac',
  postalCode: '33600',
  sellerType: 'particulier',
  ...fields,
});

export const knownVehicle = (fields: Partial<Vehicle> = {}): Vehicle => ({
  id: 1,
  fingerprint: fingerprint(
    { make: 'Porsche', model: '911 Carrera S', family: 'allemandes', year: 2015 },
    { title: LEBONCOIN_911_TITLE, postalCode: '33600' },
  ),
  make: 'Porsche',
  model: '911 Carrera S',
  family: 'allemandes',
  year: 2015,
  km: 42000,
  price: 89900,
  city: 'Pessac',
  postalCode: '33600',
  ...PESSAC,
  status: 'nouveau',
  doNotContact: false,
  matched: true,
  rejections: [],
  messageOverride: null,
  note: null,
  firstSeenAt: FIRST_READ_AT,
  lastSeenAt: FIRST_READ_AT,
  publishedAt: null,
  notifiedAt: FIRST_READ_AT,
  priceDropped: false,
  reposted: false,
  ...fields,
});

export const knownListing = (fields: Partial<Listing> = {}): Listing => ({
  id: 1,
  vehicleId: 1,
  site: 'leboncoin',
  siteLabel: 'Leboncoin',
  externalId: LEBONCOIN_911_ID,
  url: `https://www.leboncoin.fr/ad/voitures/${LEBONCOIN_911_ID}`,
  title: LEBONCOIN_911_TITLE,
  price: 89900,
  km: 42000,
  year: 2015,
  city: 'Pessac',
  postalCode: '33600',
  sellerType: 'particulier',
  imageUrl: null,
  description: null,
  publishedAt: null,
  sourceRef: null,
  firstSeenAt: FIRST_READ_AT,
  lastSeenAt: FIRST_READ_AT,
  ...fields,
});
