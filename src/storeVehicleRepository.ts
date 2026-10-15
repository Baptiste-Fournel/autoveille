import type { RejectedCounts, VehicleCursor, VehicleRepository, VehicleSelection } from './application/ports/vehicleRepository.js';
import type { EventRow, ListingRow, Store, VehicleRow } from './db.js';
import { type RejectionGroup, rejectionGroupOf } from './domain/filtering/rejectionGroups.js';
import type { VehicleReevaluation } from './domain/ingest/reevaluate.js';
import type {
  ListingChanges,
  NewListing,
  NewVehicle,
  RegroupingChanges,
  VehicleSightingChanges,
  VehicleUpdateChanges,
} from './domain/vehicle/changes.js';
import { EVENT_TYPES, type VehicleEventType } from './domain/vehicle/events.js';
import type { Listing, Vehicle, VehicleEvent } from './domain/vehicle/types.js';
import { rejectionsToStore, storedRejections } from './storedRejections.js';

type ListingRowChanges = ListingChanges & { readonly vehicleId?: number };

const EVENT_TYPE_VALUES: readonly string[] = Object.values(EVENT_TYPES);

const isEventType = (type: string): type is VehicleEventType => EVENT_TYPE_VALUES.includes(type);

const flag = (value: boolean): number => (value ? 1 : 0);

export const vehicleOf = (row: VehicleRow): Vehicle => ({
  id: row.id,
  fingerprint: row.fingerprint,
  make: row.make,
  model: row.model,
  family: row.family,
  year: row.year,
  km: row.km,
  price: row.price,
  city: row.city,
  postalCode: row.postal_code,
  lat: row.lat,
  lon: row.lon,
  distanceKm: row.distance_km,
  status: row.status,
  doNotContact: Boolean(row.do_not_contact),
  matched: Boolean(row.matched),
  rejections: storedRejections(row.reasons, row.distance_km),
  messageOverride: row.message_override,
  note: row.note,
  firstSeenAt: row.first_seen_at,
  lastSeenAt: row.last_seen_at,
  publishedAt: row.published_at,
  notifiedAt: row.notified_at,
  priceDropped: Boolean(row.price_dropped),
  reposted: Boolean(row.reposted),
});

const vehicleRowChanges = (changes: Partial<NewVehicle>): Partial<VehicleRow> => ({
  ...(changes.fingerprint === undefined ? {} : { fingerprint: changes.fingerprint }),
  ...(changes.make === undefined ? {} : { make: changes.make }),
  ...(changes.model === undefined ? {} : { model: changes.model }),
  ...(changes.family === undefined ? {} : { family: changes.family }),
  ...(changes.year === undefined ? {} : { year: changes.year }),
  ...(changes.km === undefined ? {} : { km: changes.km }),
  ...(changes.price === undefined ? {} : { price: changes.price }),
  ...(changes.city === undefined ? {} : { city: changes.city }),
  ...(changes.postalCode === undefined ? {} : { postal_code: changes.postalCode }),
  ...(changes.lat === undefined ? {} : { lat: changes.lat }),
  ...(changes.lon === undefined ? {} : { lon: changes.lon }),
  ...(changes.distanceKm === undefined ? {} : { distance_km: changes.distanceKm }),
  ...(changes.status === undefined ? {} : { status: changes.status }),
  ...(changes.doNotContact === undefined ? {} : { do_not_contact: flag(changes.doNotContact) }),
  ...(changes.matched === undefined ? {} : { matched: flag(changes.matched) }),
  ...(changes.rejections === undefined ? {} : { reasons: rejectionsToStore(changes.rejections) }),
  ...(changes.messageOverride === undefined ? {} : { message_override: changes.messageOverride }),
  ...(changes.note === undefined ? {} : { note: changes.note }),
  ...(changes.firstSeenAt === undefined ? {} : { first_seen_at: changes.firstSeenAt }),
  ...(changes.lastSeenAt === undefined ? {} : { last_seen_at: changes.lastSeenAt }),
  ...(changes.publishedAt === undefined ? {} : { published_at: changes.publishedAt }),
  ...(changes.notifiedAt === undefined ? {} : { notified_at: changes.notifiedAt }),
  ...(changes.priceDropped === undefined ? {} : { price_dropped: flag(changes.priceDropped) }),
  ...(changes.reposted === undefined ? {} : { reposted: flag(changes.reposted) }),
});

const sightingFields = ({
  price,
  priceDropped,
  km,
  year,
  publishedAt,
  reposted,
  matched,
  rejections,
  lastSeenAt,
}: VehicleSightingChanges): Partial<NewVehicle> => ({
  price,
  priceDropped,
  km,
  year,
  publishedAt,
  reposted,
  matched,
  rejections,
  lastSeenAt,
});

const regroupingFields = ({ make, model, family, fingerprint, reposted, matched, rejections }: RegroupingChanges): Partial<NewVehicle> => ({
  make,
  model,
  family,
  fingerprint,
  reposted,
  matched,
  rejections,
});

const reevaluationFields = ({ matched, rejections, distanceKm, make, model, family }: VehicleReevaluation): Partial<NewVehicle> => ({
  matched,
  rejections,
  distanceKm,
  make,
  model,
  family,
});

const updateFields = ({ status, doNotContact, messageOverride, note, matched, rejections }: VehicleUpdateChanges): Partial<NewVehicle> => ({
  status,
  doNotContact,
  messageOverride,
  note,
  matched,
  rejections,
});

const newVehicleRow = (vehicle: Omit<Vehicle, 'id'>): Omit<VehicleRow, 'id'> => ({
  fingerprint: vehicle.fingerprint,
  make: vehicle.make,
  model: vehicle.model,
  family: vehicle.family,
  year: vehicle.year,
  km: vehicle.km,
  price: vehicle.price,
  city: vehicle.city,
  postal_code: vehicle.postalCode,
  lat: vehicle.lat,
  lon: vehicle.lon,
  distance_km: vehicle.distanceKm,
  status: vehicle.status,
  do_not_contact: flag(vehicle.doNotContact),
  matched: flag(vehicle.matched),
  reasons: rejectionsToStore(vehicle.rejections),
  message_override: vehicle.messageOverride,
  first_seen_at: vehicle.firstSeenAt,
  last_seen_at: vehicle.lastSeenAt,
  notified_at: vehicle.notifiedAt,
  price_dropped: flag(vehicle.priceDropped),
  reposted: flag(vehicle.reposted),
  note: vehicle.note,
  published_at: vehicle.publishedAt,
});

const listingOf = (row: ListingRow): Listing => ({
  id: row.id,
  vehicleId: row.vehicle_id,
  site: row.site,
  siteLabel: row.site_label,
  externalId: row.external_id,
  url: row.url,
  title: row.title,
  price: row.price,
  km: row.km,
  year: row.year,
  city: row.city,
  postalCode: row.postal_code,
  sellerType: row.seller_type,
  imageUrl: row.image_url,
  description: row.description,
  publishedAt: row.published_at,
  sourceRef: row.source_ref,
  firstSeenAt: row.first_seen_at,
  lastSeenAt: row.last_seen_at,
});

const newListingRow = (vehicleId: number, listing: NewListing): Omit<ListingRow, 'id'> => ({
  vehicle_id: vehicleId,
  site: listing.site,
  site_label: listing.siteLabel,
  external_id: listing.externalId,
  url: listing.url,
  title: listing.title,
  price: listing.price,
  km: listing.km,
  year: listing.year,
  city: listing.city,
  postal_code: listing.postalCode,
  seller_type: listing.sellerType,
  image_url: listing.imageUrl,
  description: listing.description,
  published_at: listing.publishedAt,
  source_ref: listing.sourceRef,
  first_seen_at: listing.firstSeenAt,
  last_seen_at: listing.lastSeenAt,
});

const listingRowChanges = (changes: ListingRowChanges): Partial<ListingRow> => ({
  ...(changes.vehicleId === undefined ? {} : { vehicle_id: changes.vehicleId }),
  ...(changes.price === undefined ? {} : { price: changes.price }),
  ...(changes.imageUrl === undefined ? {} : { image_url: changes.imageUrl }),
  ...(changes.description === undefined ? {} : { description: changes.description }),
  ...(changes.publishedAt === undefined ? {} : { published_at: changes.publishedAt }),
  ...(changes.lastSeenAt === undefined ? {} : { last_seen_at: changes.lastSeenAt }),
});

const eventsOf = (row: EventRow): readonly VehicleEvent[] =>
  isEventType(row.type) ? [{ id: row.id, vehicleId: row.vehicle_id, type: row.type, detail: row.detail, at: row.at }] : [];

const compareText = (a: string, b: string): number => {
  if (a === b) {
    return 0;
  }
  return a < b ? -1 : 1;
};

const sortAtOf = (vehicle: Vehicle): string => vehicle.publishedAt ?? vehicle.firstSeenAt;

const mostRecentlySortedFirst = (a: Vehicle, b: Vehicle): number => compareText(sortAtOf(b), sortAtOf(a)) || b.id - a.id;

const comesAfter = (vehicle: Vehicle, cursor: VehicleCursor | undefined): boolean => {
  if (cursor === undefined) {
    return true;
  }
  const sortAt = sortAtOf(vehicle);
  return sortAt < cursor.sortAt || (sortAt === cursor.sortAt && vehicle.id < cursor.id);
};

const groupsOf = (vehicle: Vehicle): readonly RejectionGroup[] => vehicle.rejections.map(rejectionGroupOf);

const isSelected = (vehicle: Vehicle, selection: VehicleSelection): boolean => {
  switch (selection.kind) {
    case 'kept':
      return vehicle.matched && (selection.status === undefined || vehicle.status === selection.status);
    case 'rejected':
      return (
        !vehicle.matched &&
        (selection.withGroup === undefined || groupsOf(vehicle).includes(selection.withGroup)) &&
        (selection.withoutGroup === undefined || !groupsOf(vehicle).includes(selection.withoutGroup))
      );
  }
};

const rejectedCountsOf = (rejected: readonly Vehicle[]): RejectedCounts => {
  const inGroup = (group: RejectionGroup): number => rejected.filter((vehicle) => groupsOf(vehicle).includes(group)).length;
  return {
    all: rejected.length,
    byGroup: { marque: inGroup('marque'), special: inGroup('special'), pro: inGroup('pro'), km: inGroup('km'), loin: inGroup('loin') },
  };
};

export const storeVehicleRepository = (store: Store): VehicleRepository => {
  const vehicle = (id: number): Vehicle | undefined => {
    const row = store.getVehicle(id);
    return row === undefined ? undefined : vehicleOf(row);
  };
  const allVehicles = (): readonly Vehicle[] => store.allVehicles().map(vehicleOf);
  return {
    vehicle,
    findListing: (site, externalId) => {
      const row = store.findListing(site, externalId);
      const owner = row === undefined ? undefined : vehicle(row.vehicle_id);
      return row === undefined || owner === undefined ? undefined : { listing: listingOf(row), vehicle: owner };
    },
    vehiclesWithFingerprint: (fingerprint) =>
      store
        .findVehiclesByFingerprint(fingerprint)
        .map(vehicleOf)
        .sort((a, b) => compareText(b.lastSeenAt, a.lastSeenAt) || a.id - b.id),
    listingsOf: (vehicleId) =>
      store
        .listingsOfVehicle(vehicleId)
        .map(listingOf)
        .sort((a, b) => compareText(a.firstSeenAt, b.firstSeenAt) || a.id - b.id),
    priceHistory: (listingId) => store.priceHistory(listingId).map((point) => ({ price: point.price, seenAt: point.seen_at })),
    events: (vehicleId) => store.events(vehicleId).flatMap(eventsOf),
    enteredStatusAt: (vehicleId, statusEvent) => store.lastEventAt(vehicleId, statusEvent),
    page: (query) => {
      const matching = allVehicles()
        .filter(
          (candidate) =>
            isSelected(candidate, query.selection) &&
            (query.firstSeenSince === undefined || candidate.firstSeenAt >= query.firstSeenSince) &&
            comesAfter(candidate, query.after),
        )
        .sort(mostRecentlySortedFirst);
      const vehicles = matching.slice(0, query.limit);
      const last = vehicles.at(-1);
      return matching.length > vehicles.length && last !== undefined
        ? { vehicles, nextCursor: { sortAt: sortAtOf(last), id: last.id } }
        : { vehicles };
    },
    rejectedCounts: (firstSeenSince) =>
      rejectedCountsOf(allVehicles().filter((candidate) => !candidate.matched && candidate.firstSeenAt >= firstSeenSince)),
    countsByStatus: () => store.countsByStatus(),
    activitySince: (since) => store.activitySince(since),
    vehiclesFirstSeenSince: (since) =>
      store
        .vehiclesFirstSeenSince(since)
        .map(vehicleOf)
        .sort((a, b) => compareText(b.firstSeenAt, a.firstSeenAt) || a.id - b.id),
    allVehicles,
    addVehicle: (newVehicle) => store.insertVehicle(newVehicleRow(newVehicle)),
    addListing: (vehicleId, listing) => store.insertListing(newListingRow(vehicleId, listing)),
    addPricePoint: (listingId, point) => store.recordPrice(listingId, point.price, point.seenAt),
    addEvent: (vehicleId, event) => store.addEvent(vehicleId, event.type, event.detail, event.at),
    eraseEvents: (vehicleId, types) => store.deleteEvents(vehicleId, [...types]),
    recordListingSighting: (listingId, changes) => store.updateListing(listingId, listingRowChanges(changes)),
    recordVehicleSighting: (vehicleId, changes) => store.updateVehicle(vehicleId, vehicleRowChanges(sightingFields(changes))),
    applyRegrouping: (vehicleId, changes) => store.updateVehicle(vehicleId, vehicleRowChanges(regroupingFields(changes))),
    moveListings: (listingIds, vehicleId) => {
      for (const listingId of listingIds) {
        store.updateListing(listingId, listingRowChanges({ vehicleId }));
      }
    },
    applyReevaluation: (vehicleId, reevaluation) => store.updateVehicle(vehicleId, vehicleRowChanges(reevaluationFields(reevaluation))),
    applyVehicleUpdate: (vehicleId, changes) => store.updateVehicle(vehicleId, vehicleRowChanges(updateFields(changes))),
    markNotified: (vehicleId, at) => store.updateVehicle(vehicleId, vehicleRowChanges({ notifiedAt: at })),
    deleteVehicle: (id) => store.deleteVehicle(id),
  };
};
