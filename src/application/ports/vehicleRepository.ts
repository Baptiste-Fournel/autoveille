import type { RejectionGroup } from '../../domain/filtering/rejectionGroups.js';
import type { VehicleReevaluation } from '../../domain/ingest/reevaluate.js';
import type {
  ListingChanges,
  NewListing,
  NewVehicle,
  RegroupingChanges,
  VehicleSightingChanges,
  VehicleUpdateChanges,
} from '../../domain/vehicle/changes.js';
import type { NewVehicleEvent, VehicleEventType } from '../../domain/vehicle/events.js';
import type { Listing, PricePoint, Status, Vehicle, VehicleEvent } from '../../domain/vehicle/types.js';

export interface KnownListing {
  readonly listing: Listing;
  readonly vehicle: Vehicle;
}

export type VehicleSelection =
  | { readonly kind: 'kept'; readonly status?: Status }
  | { readonly kind: 'rejected'; readonly withGroup?: RejectionGroup; readonly withoutGroup?: RejectionGroup };

export interface VehicleCursor {
  readonly sortAt: string;
  readonly id: number;
}

export interface VehiclePageQuery {
  readonly selection: VehicleSelection;
  readonly firstSeenSince?: string;
  readonly after?: VehicleCursor;
  readonly limit: number;
}

export interface VehiclePage {
  readonly vehicles: readonly Vehicle[];
  readonly nextCursor?: VehicleCursor;
}

export interface RejectedCounts {
  readonly all: number;
  readonly byGroup: Readonly<Record<RejectionGroup, number>>;
}

export type StatusCounts = Readonly<Record<Status, number>>;

export interface Activity {
  readonly received: number;
  readonly contacted: number;
  readonly replied: number;
}

export interface VehicleRepository {
  vehicle(id: number): Vehicle | undefined;
  findListing(site: string, externalId: string): KnownListing | undefined;
  vehiclesWithFingerprint(fingerprint: string): readonly Vehicle[];
  listingsOf(vehicleId: number): readonly Listing[];
  priceHistory(listingId: number): readonly PricePoint[];
  events(vehicleId: number): readonly VehicleEvent[];
  enteredStatusAt(vehicleId: number, statusEvent: VehicleEventType): string | null;
  page(query: VehiclePageQuery): VehiclePage;
  rejectedCounts(firstSeenSince: string): RejectedCounts;
  countsByStatus(): StatusCounts;
  activitySince(since: string): Activity;
  vehiclesFirstSeenSince(since: string): readonly Vehicle[];
  allVehicles(): readonly Vehicle[];
  addVehicle(vehicle: NewVehicle): number;
  addListing(vehicleId: number, listing: NewListing): number;
  addPricePoint(listingId: number, point: PricePoint): void;
  addEvent(vehicleId: number, event: NewVehicleEvent): void;
  eraseEvents(vehicleId: number, types: readonly VehicleEventType[]): void;
  recordListingSighting(listingId: number, changes: ListingChanges): void;
  recordVehicleSighting(vehicleId: number, changes: VehicleSightingChanges): void;
  applyRegrouping(vehicleId: number, changes: RegroupingChanges): void;
  moveListings(listingIds: readonly number[], vehicleId: number): void;
  applyReevaluation(vehicleId: number, reevaluation: VehicleReevaluation): void;
  applyVehicleUpdate(vehicleId: number, changes: VehicleUpdateChanges): void;
  markNotified(vehicleId: number, at: string): void;
  deleteVehicle(id: number): void;
}
