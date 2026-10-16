import type { RejectedCounts, VehicleCursor } from '../../../application/ports/vehicleRepository.js';
import type { Family } from '../../../domain/catalog/families.js';
import { REJECTION_GROUP_OF_KIND } from '../../../domain/filtering/rejectionGroups.js';
import type { RejectionReason } from '../../../domain/filtering/verdict.js';
import type { VehicleReevaluation } from '../../../domain/ingest/reevaluate.js';
import type {
  ListingChanges,
  NewListing,
  NewVehicle,
  RegroupingChanges,
  VehicleSightingChanges,
  VehicleUpdateChanges,
} from '../../../domain/vehicle/changes.js';
import { EVENT_TYPES, type NewVehicleEvent, type VehicleEventType } from '../../../domain/vehicle/events.js';
import type { Listing, PricePoint, SellerType, Status, Vehicle, VehicleEvent } from '../../../domain/vehicle/types.js';

export interface VehicleRow {
  readonly id: number;
  readonly fingerprint: string;
  readonly make: string | null;
  readonly model: string | null;
  readonly family: Family;
  readonly year: number | null;
  readonly km: number | null;
  readonly price: number | null;
  readonly city: string | null;
  readonly postal_code: string | null;
  readonly lat: number | null;
  readonly lon: number | null;
  readonly distance_km: number | null;
  readonly status: Status;
  readonly do_not_contact: number;
  readonly matched: number;
  readonly message_override: string | null;
  readonly note: string | null;
  readonly first_seen_at: string;
  readonly last_seen_at: string;
  readonly published_at: string | null;
  readonly notified_at: string | null;
  readonly price_dropped: number;
  readonly reposted: number;
  readonly sort_at: string;
  readonly rejections: string;
}

export interface ListingRow {
  readonly id: number;
  readonly vehicle_id: number;
  readonly site: string;
  readonly site_label: string;
  readonly external_id: string;
  readonly url: string;
  readonly title: string;
  readonly price: number | null;
  readonly km: number | null;
  readonly year: number | null;
  readonly city: string | null;
  readonly postal_code: string | null;
  readonly seller_type: SellerType;
  readonly image_url: string | null;
  readonly description: string | null;
  readonly published_at: string | null;
  readonly source_ref: string | null;
  readonly first_seen_at: string;
  readonly last_seen_at: string;
}

export interface PricePointRow {
  readonly price: number;
  readonly seen_at: string;
}

export interface EventRow {
  readonly id: number;
  readonly vehicle_id: number;
  readonly type: string;
  readonly detail: string | null;
  readonly at: string;
}

export interface RejectedCountsRow {
  readonly all_rejected: number;
  readonly marque: number;
  readonly special: number;
  readonly pro: number;
  readonly km: number;
  readonly loin: number;
}

export interface RejectionRow {
  readonly vehicle_id: number;
  readonly position: number;
  readonly kind: RejectionReason['kind'];
  readonly payload: string;
}

interface StoredRejection {
  readonly kind: string;
  readonly payload: Readonly<Record<string, unknown>>;
}

type Flag = 0 | 1;

const EVENT_TYPE_VALUES: readonly string[] = Object.values(EVENT_TYPES);

const isRejectionKind = (kind: string): kind is RejectionReason['kind'] => Object.hasOwn(REJECTION_GROUP_OF_KIND, kind);

const isEventType = (type: string): type is VehicleEventType => EVENT_TYPE_VALUES.includes(type);

const flag = (value: boolean): Flag => (value ? 1 : 0);

const presence = (value: unknown): Flag => (value === undefined ? 0 : 1);

const optionalFlag = (value: boolean | undefined): Flag | null => (value === undefined ? null : flag(value));

const rejectionsOf = (stored: string): readonly RejectionReason[] => {
  const rejections: readonly StoredRejection[] = JSON.parse(stored);
  return rejections.flatMap(({ kind, payload }) => (isRejectionKind(kind) ? [{ kind, ...payload } as RejectionReason] : []));
};

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
  rejections: rejectionsOf(row.rejections),
  messageOverride: row.message_override,
  note: row.note,
  firstSeenAt: row.first_seen_at,
  lastSeenAt: row.last_seen_at,
  publishedAt: row.published_at,
  notifiedAt: row.notified_at,
  priceDropped: Boolean(row.price_dropped),
  reposted: Boolean(row.reposted),
});

export const cursorOf = (row: VehicleRow): VehicleCursor => ({ sortAt: row.sort_at, id: row.id });

export const rejectedCountsOf = (row: RejectedCountsRow): RejectedCounts => ({
  all: row.all_rejected,
  byGroup: { marque: row.marque, special: row.special, pro: row.pro, km: row.km, loin: row.loin },
});

export const newVehicleParameters = (vehicle: NewVehicle) => ({
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
  message_override: vehicle.messageOverride,
  note: vehicle.note,
  first_seen_at: vehicle.firstSeenAt,
  last_seen_at: vehicle.lastSeenAt,
  published_at: vehicle.publishedAt,
  notified_at: vehicle.notifiedAt,
  price_dropped: flag(vehicle.priceDropped),
  reposted: flag(vehicle.reposted),
});

export const rejectionRows = (vehicleId: number, rejections: readonly RejectionReason[]): readonly RejectionRow[] =>
  rejections.map(({ kind, ...fields }, position) => ({ vehicle_id: vehicleId, position, kind, payload: JSON.stringify(fields) }));

export const sightingParameters = (vehicleId: number, changes: VehicleSightingChanges) => ({
  id: vehicleId,
  has_price: presence(changes.price),
  price: changes.price ?? null,
  has_price_dropped: presence(changes.priceDropped),
  price_dropped: optionalFlag(changes.priceDropped),
  has_km: presence(changes.km),
  km: changes.km ?? null,
  has_year: presence(changes.year),
  year: changes.year ?? null,
  has_published_at: presence(changes.publishedAt),
  published_at: changes.publishedAt ?? null,
  has_reposted: presence(changes.reposted),
  reposted: optionalFlag(changes.reposted),
  has_matched: presence(changes.matched),
  matched: optionalFlag(changes.matched),
  has_last_seen_at: presence(changes.lastSeenAt),
  last_seen_at: changes.lastSeenAt ?? null,
});

export const regroupingParameters = (vehicleId: number, changes: RegroupingChanges) => ({
  id: vehicleId,
  has_make: presence(changes.make),
  make: changes.make ?? null,
  has_model: presence(changes.model),
  model: changes.model ?? null,
  has_family: presence(changes.family),
  family: changes.family ?? null,
  has_fingerprint: presence(changes.fingerprint),
  fingerprint: changes.fingerprint ?? null,
  has_reposted: presence(changes.reposted),
  reposted: optionalFlag(changes.reposted),
  has_matched: presence(changes.matched),
  matched: optionalFlag(changes.matched),
});

export const reevaluationParameters = (vehicleId: number, reevaluation: VehicleReevaluation) => ({
  id: vehicleId,
  matched: flag(reevaluation.matched),
  distance_km: reevaluation.distanceKm,
  make: reevaluation.make,
  model: reevaluation.model,
  family: reevaluation.family,
});

export const vehicleUpdateParameters = (vehicleId: number, changes: VehicleUpdateChanges) => ({
  id: vehicleId,
  has_status: presence(changes.status),
  status: changes.status ?? null,
  has_do_not_contact: presence(changes.doNotContact),
  do_not_contact: optionalFlag(changes.doNotContact),
  has_message_override: presence(changes.messageOverride),
  message_override: changes.messageOverride ?? null,
  has_note: presence(changes.note),
  note: changes.note ?? null,
  has_matched: presence(changes.matched),
  matched: optionalFlag(changes.matched),
});

export const listingOf = (row: ListingRow): Listing => ({
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

export const newListingParameters = (vehicleId: number, listing: NewListing) => ({
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

export const listingSightingParameters = (listingId: number, changes: ListingChanges) => ({
  id: listingId,
  has_price: presence(changes.price),
  price: changes.price ?? null,
  has_image_url: presence(changes.imageUrl),
  image_url: changes.imageUrl ?? null,
  has_description: presence(changes.description),
  description: changes.description ?? null,
  has_published_at: presence(changes.publishedAt),
  published_at: changes.publishedAt ?? null,
  has_last_seen_at: presence(changes.lastSeenAt),
  last_seen_at: changes.lastSeenAt ?? null,
});

export const pricePointOf = (row: PricePointRow): PricePoint => ({ price: row.price, seenAt: row.seen_at });

export const pricePointParameters = (listingId: number, point: PricePoint) => ({
  listing_id: listingId,
  price: point.price,
  seen_at: point.seenAt,
});

export const newEventParameters = (vehicleId: number, event: NewVehicleEvent) => ({
  vehicle_id: vehicleId,
  type: event.type,
  detail: event.detail,
  at: event.at,
});

export const eventsOf = (row: EventRow): readonly VehicleEvent[] =>
  isEventType(row.type) ? [{ id: row.id, vehicleId: row.vehicle_id, type: row.type, detail: row.detail, at: row.at }] : [];
