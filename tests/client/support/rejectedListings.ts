import type { RejectedKind, RejectedKindCountsDto, VehicleDto } from '../../../src/shared/api';
import { type FakeServer, json, notModified } from './fakeServer';
import { serverForSignedInDealer } from './testApplication';
import { overviewWith } from './vehicles';

type RejectionGroup = Exclude<RejectedKind, 'tous' | 'suivies'>;

export interface RejectedListing {
  readonly vehicle: VehicleDto;
  readonly groups: readonly RejectionGroup[];
}

const UNFOLLOWED_BRANDS: RejectionGroup = 'marque';

const GROUPS: readonly RejectionGroup[] = ['marque', 'special', 'pro', 'km', 'loin'];

const isRejectedKind = (value: string | null): value is RejectedKind =>
  value === 'tous' || value === 'suivies' || GROUPS.some((group) => group === value);

const inKind =
  (kind: RejectedKind) =>
  (listing: RejectedListing): boolean => {
    switch (kind) {
      case 'tous':
        return true;
      case 'suivies':
        return !listing.groups.includes(UNFOLLOWED_BRANDS);
      default:
        return listing.groups.includes(kind);
    }
  };

const kindsOf = (listings: readonly RejectedListing[]): RejectedKindCountsDto => ({
  tous: listings.length,
  suivies: listings.filter(inKind('suivies')).length,
  marque: listings.filter(inKind('marque')).length,
  special: listings.filter(inKind('special')).length,
  pro: listings.filter(inKind('pro')).length,
  km: listings.filter(inKind('km')).length,
  loin: listings.filter(inKind('loin')).length,
});

export const serverWithRejectedListings = (rejected: readonly RejectedListing[]): FakeServer => {
  const server = serverForSignedInDealer();
  const kept = new Set<number>();
  const stillRejected = (): readonly RejectedListing[] => rejected.filter(({ vehicle }) => !kept.has(vehicle.id));
  server.on('GET', '/api/overview', () => json(200, overviewWith({ nouveau: kept.size })));
  server.on('GET', '/api/vehicles', (request) => {
    if (request.query.get('status') !== 'ecartees') {
      return json(200, { vehicles: [], nextCursor: null });
    }
    const asked = request.query.get('kind');
    const kind = isRejectedKind(asked) ? asked : 'suivies';
    const listings = stillRejected();
    const vehicles = listings.filter(inKind(kind)).map(({ vehicle }) => vehicle);
    const etag = `W/"ecartees-${kind}-${vehicles.map(({ id }) => id).join('-')}-${listings.length}"`;
    if (request.headers.get('if-none-match') === etag) {
      return notModified();
    }
    return json(200, { vehicles, nextCursor: null, kinds: kindsOf(listings) }, { etag });
  });
  for (const { vehicle } of rejected) {
    server.on('POST', `/api/vehicles/${vehicle.id}`, () => {
      kept.add(vehicle.id);
      return json(200, { ...vehicle, matched: true, reasons: [], status: 'nouveau' });
    });
  }
  return server;
};
