import type { KnownListing, VehicleCursor, VehicleRepository, VehicleSelection } from '../../src/application/ports/vehicleRepository.js';
import { type RejectionGroup, rejectionGroupOf } from '../../src/domain/filtering/rejectionGroups.js';
import type { VehicleReevaluation } from '../../src/domain/ingest/reevaluate.js';
import type { ListingChanges, RegroupingChanges, VehicleSightingChanges, VehicleUpdateChanges } from '../../src/domain/vehicle/changes.js';
import { EVENT_TYPES, type VehicleEventType } from '../../src/domain/vehicle/events.js';
import type { Listing, PricePoint, Vehicle, VehicleEvent } from '../../src/domain/vehicle/types.js';
import type { TransactionParticipant } from './fakeTransaction.js';

export type FakeVehicleRepository = VehicleRepository & TransactionParticipant;

interface StoredPricePoint extends PricePoint {
  readonly id: number;
  readonly listingId: number;
}

interface LastIds {
  readonly vehicle: number;
  readonly listing: number;
  readonly pricePoint: number;
  readonly event: number;
}

interface State {
  readonly vehicles: readonly Vehicle[];
  readonly listings: readonly Listing[];
  readonly pricePoints: readonly StoredPricePoint[];
  readonly events: readonly VehicleEvent[];
  readonly lastIds: LastIds;
}

const EMPTY: State = {
  vehicles: [],
  listings: [],
  pricePoints: [],
  events: [],
  lastIds: { vehicle: 0, listing: 0, pricePoint: 0, event: 0 },
};

const compareText = (a: string, b: string): number => {
  if (a === b) {
    return 0;
  }
  return a < b ? -1 : 1;
};

const sortAtOf = (vehicle: Vehicle): string => vehicle.publishedAt ?? vehicle.firstSeenAt;

const sorted = <T>(items: readonly T[], order: (a: T, b: T) => number): readonly T[] => [...items].sort(order);

const mostRecentlySortedFirst = (a: Vehicle, b: Vehicle): number => compareText(sortAtOf(b), sortAtOf(a)) || b.id - a.id;

const comesAfter = (vehicle: Vehicle, cursor: VehicleCursor): boolean => {
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

const isFirstSeenSince = (vehicle: Vehicle, since: string | undefined): boolean => since === undefined || vehicle.firstSeenAt >= since;

const when = <T, C extends object>(value: T | undefined, change: (value: T) => C): C | Record<string, never> =>
  value === undefined ? {} : change(value);

const sighted = (vehicle: Vehicle, changes: VehicleSightingChanges): Vehicle => ({
  ...vehicle,
  ...when(changes.price, (price) => ({ price })),
  ...when(changes.priceDropped, (priceDropped) => ({ priceDropped })),
  ...when(changes.km, (km) => ({ km })),
  ...when(changes.year, (year) => ({ year })),
  ...when(changes.publishedAt, (publishedAt) => ({ publishedAt })),
  ...when(changes.reposted, (reposted) => ({ reposted })),
  ...when(changes.matched, (matched) => ({ matched })),
  ...when(changes.rejections, (rejections) => ({ rejections })),
  ...when(changes.lastSeenAt, (lastSeenAt) => ({ lastSeenAt })),
});

const regrouped = (vehicle: Vehicle, changes: RegroupingChanges): Vehicle => ({
  ...vehicle,
  ...when(changes.make, (make) => ({ make })),
  ...when(changes.model, (model) => ({ model })),
  ...when(changes.family, (family) => ({ family })),
  ...when(changes.fingerprint, (fingerprint) => ({ fingerprint })),
  ...when(changes.reposted, (reposted) => ({ reposted })),
  ...when(changes.matched, (matched) => ({ matched })),
  ...when(changes.rejections, (rejections) => ({ rejections })),
});

const reevaluated = (vehicle: Vehicle, reevaluation: VehicleReevaluation): Vehicle => ({
  ...vehicle,
  matched: reevaluation.matched,
  rejections: reevaluation.rejections,
  distanceKm: reevaluation.distanceKm,
  make: reevaluation.make,
  model: reevaluation.model,
  family: reevaluation.family,
});

const updated = (vehicle: Vehicle, changes: VehicleUpdateChanges): Vehicle => ({
  ...vehicle,
  ...when(changes.status, (status) => ({ status })),
  ...when(changes.doNotContact, (doNotContact) => ({ doNotContact })),
  ...when(changes.messageOverride, (messageOverride) => ({ messageOverride })),
  ...when(changes.note, (note) => ({ note })),
  ...when(changes.matched, (matched) => ({ matched })),
  ...when(changes.rejections, (rejections) => ({ rejections })),
});

const listingSighted = (listing: Listing, changes: ListingChanges): Listing => ({
  ...listing,
  ...when(changes.price, (price) => ({ price })),
  ...when(changes.imageUrl, (imageUrl) => ({ imageUrl })),
  ...when(changes.description, (description) => ({ description })),
  ...when(changes.publishedAt, (publishedAt) => ({ publishedAt })),
  ...when(changes.lastSeenAt, (lastSeenAt) => ({ lastSeenAt })),
});

const foreignKeyFailure = (): Error => new Error('FOREIGN KEY constraint failed');

export const fakeVehicleRepository = (): FakeVehicleRepository => {
  let state: State = EMPTY;

  const vehicle = (id: number): Vehicle | undefined => state.vehicles.find((candidate) => candidate.id === id);
  const listing = (id: number): Listing | undefined => state.listings.find((candidate) => candidate.id === id);
  const requireVehicle = (id: number): void => {
    if (vehicle(id) === undefined) {
      throw foreignKeyFailure();
    }
  };
  const changeVehicle = (id: number, change: (current: Vehicle) => Vehicle): void => {
    state = { ...state, vehicles: state.vehicles.map((current) => (current.id === id ? change(current) : current)) };
  };
  const changeListings = (isChanged: (current: Listing) => boolean, change: (current: Listing) => Listing): void => {
    state = { ...state, listings: state.listings.map((current) => (isChanged(current) ? change(current) : current)) };
  };
  const contactedOrRepliedSince = (type: VehicleEventType, since: string): number =>
    new Set(state.events.filter((event) => event.type === type && event.at >= since).map((event) => event.vehicleId)).size;

  return {
    vehicle,
    findListing: (site, externalId): KnownListing | undefined => {
      const found = state.listings.find((candidate) => candidate.site === site && candidate.externalId === externalId);
      const owner = found === undefined ? undefined : vehicle(found.vehicleId);
      return found === undefined || owner === undefined ? undefined : { listing: found, vehicle: owner };
    },
    vehiclesWithFingerprint: (fingerprint) =>
      sorted(
        state.vehicles.filter((candidate) => candidate.fingerprint === fingerprint),
        (a, b) => compareText(b.lastSeenAt, a.lastSeenAt) || a.id - b.id,
      ),
    listingsOf: (vehicleId) =>
      sorted(
        state.listings.filter((candidate) => candidate.vehicleId === vehicleId),
        (a, b) => compareText(a.firstSeenAt, b.firstSeenAt) || a.id - b.id,
      ),
    priceHistory: (listingId) =>
      sorted(
        state.pricePoints.filter((point) => point.listingId === listingId),
        (a, b) => compareText(a.seenAt, b.seenAt) || a.id - b.id,
      ).map((point) => ({ price: point.price, seenAt: point.seenAt })),
    events: (vehicleId) =>
      sorted(
        state.events.filter((event) => event.vehicleId === vehicleId),
        (a, b) => compareText(b.at, a.at) || b.id - a.id,
      ),
    enteredStatusAt: (vehicleId, statusEvent) =>
      state.events
        .filter((event) => event.vehicleId === vehicleId && event.type === statusEvent)
        .map((event) => event.at)
        .reduce<string | null>((latest, at) => (latest === null || at > latest ? at : latest), null),
    page: (query) => {
      const matching = sorted(
        state.vehicles.filter(
          (candidate) =>
            isSelected(candidate, query.selection) &&
            isFirstSeenSince(candidate, query.firstSeenSince) &&
            (query.after === undefined || comesAfter(candidate, query.after)),
        ),
        mostRecentlySortedFirst,
      );
      const vehicles = matching.slice(0, query.limit);
      const last = vehicles.at(-1);
      return matching.length > vehicles.length && last !== undefined
        ? { vehicles, nextCursor: { sortAt: sortAtOf(last), id: last.id } }
        : { vehicles };
    },
    rejectedCounts: (firstSeenSince) => {
      const rejected = state.vehicles.filter((candidate) => !candidate.matched && candidate.firstSeenAt >= firstSeenSince);
      const inGroup = (group: RejectionGroup): number => rejected.filter((candidate) => groupsOf(candidate).includes(group)).length;
      return {
        all: rejected.length,
        byGroup: { marque: inGroup('marque'), special: inGroup('special'), pro: inGroup('pro'), km: inGroup('km'), loin: inGroup('loin') },
      };
    },
    countsByStatus: () => {
      const kept = state.vehicles.filter((candidate) => candidate.matched);
      const withStatus = (status: Vehicle['status']): number => kept.filter((candidate) => candidate.status === status).length;
      return {
        nouveau: withStatus('nouveau'),
        contacte: withStatus('contacte'),
        repondu: withStatus('repondu'),
        ignore: withStatus('ignore'),
      };
    },
    activitySince: (since) => ({
      received: state.vehicles.filter((candidate) => candidate.matched && candidate.firstSeenAt >= since).length,
      contacted: contactedOrRepliedSince(EVENT_TYPES.markedContacted, since),
      replied: contactedOrRepliedSince(EVENT_TYPES.markedReplied, since),
    }),
    vehiclesFirstSeenSince: (since) =>
      sorted(
        state.vehicles.filter((candidate) => candidate.firstSeenAt >= since),
        (a, b) => compareText(b.firstSeenAt, a.firstSeenAt) || a.id - b.id,
      ),
    allVehicles: () => sorted(state.vehicles, (a, b) => a.id - b.id),
    addVehicle: (newVehicle) => {
      const id = state.lastIds.vehicle + 1;
      state = { ...state, vehicles: [...state.vehicles, { id, ...newVehicle }], lastIds: { ...state.lastIds, vehicle: id } };
      return id;
    },
    addListing: (vehicleId, newListing) => {
      requireVehicle(vehicleId);
      if (state.listings.some((candidate) => candidate.site === newListing.site && candidate.externalId === newListing.externalId)) {
        throw new Error('UNIQUE constraint failed: listings.site, listings.external_id');
      }
      const id = state.lastIds.listing + 1;
      state = { ...state, listings: [...state.listings, { id, vehicleId, ...newListing }], lastIds: { ...state.lastIds, listing: id } };
      return id;
    },
    addPricePoint: (listingId, point) => {
      if (listing(listingId) === undefined) {
        throw foreignKeyFailure();
      }
      const id = state.lastIds.pricePoint + 1;
      state = {
        ...state,
        pricePoints: [...state.pricePoints, { id, listingId, price: point.price, seenAt: point.seenAt }],
        lastIds: { ...state.lastIds, pricePoint: id },
      };
    },
    addEvent: (vehicleId, event) => {
      requireVehicle(vehicleId);
      const id = state.lastIds.event + 1;
      state = {
        ...state,
        events: [...state.events, { id, vehicleId, type: event.type, detail: event.detail, at: event.at }],
        lastIds: { ...state.lastIds, event: id },
      };
    },
    eraseEvents: (vehicleId, types) => {
      state = { ...state, events: state.events.filter((event) => event.vehicleId !== vehicleId || !types.includes(event.type)) };
    },
    recordListingSighting: (listingId, changes) => {
      changeListings(
        (current) => current.id === listingId,
        (current) => listingSighted(current, changes),
      );
    },
    recordVehicleSighting: (vehicleId, changes) => {
      changeVehicle(vehicleId, (current) => sighted(current, changes));
    },
    applyRegrouping: (vehicleId, changes) => {
      changeVehicle(vehicleId, (current) => regrouped(current, changes));
    },
    moveListings: (listingIds, vehicleId) => {
      requireVehicle(vehicleId);
      changeListings(
        (current) => listingIds.includes(current.id),
        (current) => ({ ...current, vehicleId }),
      );
    },
    applyReevaluation: (vehicleId, reevaluation) => {
      changeVehicle(vehicleId, (current) => reevaluated(current, reevaluation));
    },
    applyVehicleUpdate: (vehicleId, changes) => {
      changeVehicle(vehicleId, (current) => updated(current, changes));
    },
    markNotified: (vehicleId, at) => {
      changeVehicle(vehicleId, (current) => ({ ...current, notifiedAt: at }));
    },
    deleteVehicle: (id) => {
      const removedListings = state.listings.filter((candidate) => candidate.vehicleId === id).map((candidate) => candidate.id);
      state = {
        ...state,
        vehicles: state.vehicles.filter((candidate) => candidate.id !== id),
        listings: state.listings.filter((candidate) => candidate.vehicleId !== id),
        pricePoints: state.pricePoints.filter((point) => !removedListings.includes(point.listingId)),
        events: state.events.filter((event) => event.vehicleId !== id),
      };
    },
    snapshot: () => {
      const kept = state;
      return () => {
        state = kept;
      };
    },
  };
};
