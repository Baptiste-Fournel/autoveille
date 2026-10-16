import { evaluate } from '../filtering/evaluate.js';
import type { Verdict } from '../filtering/verdict.js';
import type { Settings } from '../settings/types.js';
import {
  type ListingChanges,
  type NewListing,
  type NewVehicle,
  newListing,
  newVehicle,
  type VehicleSightingChanges,
} from '../vehicle/changes.js';
import { earlierPublishedAt } from '../vehicle/earlierPublishedAt.js';
import { EVENT_TYPES, type NewVehicleEvent, priceChangeDetail, sightingDetail } from '../vehicle/events.js';
import { isAwaitingDecision } from '../vehicle/status.js';
import type { Listing, PricePoint, RawListing, Vehicle, VehicleInfo } from '../vehicle/types.js';
import { type Attachment, attachmentOf, type Identification } from './identify.js';
import type { VehicleLocation } from './location.js';

export interface IngestInput {
  readonly listing: RawListing;
  readonly info: VehicleInfo;
  readonly settings: Settings;
  readonly identification: Identification;
  readonly now: string;
}

export interface PriceChanged {
  readonly kind: 'priceChanged';
  readonly vehicleId: number;
  readonly listingId: number;
  readonly listing: RawListing;
  readonly from: number;
  readonly to: number;
  readonly pricePoint: PricePoint;
  readonly listingChanges: ListingChanges;
  readonly vehicleChanges: VehicleSightingChanges;
  readonly vehicle: Vehicle;
  readonly event: NewVehicleEvent;
}

export interface SeenAgain {
  readonly kind: 'seenAgain';
  readonly vehicleId: number;
  readonly listingId: number;
  readonly listingChanges: ListingChanges;
  readonly vehicleChanges: VehicleSightingChanges;
  readonly verdict: Verdict | undefined;
}

export interface AttachedToVehicle {
  readonly kind: 'attachedToVehicle';
  readonly attachment: Attachment;
  readonly vehicleId: number;
  readonly newListing: NewListing;
  readonly pricePoint: PricePoint | undefined;
  readonly vehicleChanges: VehicleSightingChanges;
  readonly event: NewVehicleEvent;
}

export interface Created {
  readonly kind: 'created';
  readonly listing: RawListing;
  readonly vehicle: NewVehicle;
  readonly verdict: Verdict;
  readonly newListing: NewListing;
  readonly pricePoint: PricePoint | undefined;
  readonly event: NewVehicleEvent;
}

export type IngestDecision = PriceChanged | SeenAgain | AttachedToVehicle | Created;

const completedFromTitle = (raw: RawListing, info: VehicleInfo): RawListing => ({
  ...raw,
  price: raw.price ?? info.price,
  km: raw.km ?? info.km,
  year: raw.year ?? info.year,
});

const publishedAtChange = (current: string | null, candidate: string | undefined): VehicleSightingChanges => {
  const publishedAt = earlierPublishedAt(current, candidate);
  return publishedAt === undefined ? {} : { publishedAt };
};

const firstPricePoint = (listing: NewListing): PricePoint | undefined =>
  listing.price === null ? undefined : { price: listing.price, seenAt: listing.firstSeenAt };

const priceChanged = (completed: RawListing, listing: Listing, vehicle: Vehicle, from: number, to: number, now: string): PriceChanged => {
  const dropped = to < from;
  const vehicleChanges = { price: to, priceDropped: dropped, lastSeenAt: now };
  return {
    kind: 'priceChanged',
    vehicleId: listing.vehicleId,
    listingId: listing.id,
    listing: completed,
    from,
    to,
    pricePoint: { price: to, seenAt: now },
    listingChanges: { price: to, lastSeenAt: now },
    vehicleChanges,
    vehicle: { ...vehicle, ...vehicleChanges },
    event: { type: dropped ? EVENT_TYPES.priceDropped : EVENT_TYPES.priceRaised, detail: priceChangeDetail(from, to), at: now },
  };
};

const listingCompletions = (completed: RawListing, listing: Listing, now: string): ListingChanges => ({
  ...(listing.price === null && completed.price !== undefined ? { price: completed.price } : {}),
  ...(completed.imageUrl && completed.imageUrl !== listing.imageUrl ? { imageUrl: completed.imageUrl } : {}),
  ...(!listing.description && completed.description ? { description: completed.description } : {}),
  ...(!listing.publishedAt && completed.publishedAt ? { publishedAt: completed.publishedAt } : {}),
  lastSeenAt: now,
});

const vehicleCompletions = (completed: RawListing, vehicle: Vehicle): VehicleSightingChanges => ({
  ...(vehicle.price === null && completed.price !== undefined ? { price: completed.price } : {}),
  ...(vehicle.km === null && completed.km !== undefined ? { km: completed.km } : {}),
  ...(vehicle.year === null && completed.year !== undefined ? { year: completed.year } : {}),
  ...publishedAtChange(vehicle.publishedAt, completed.publishedAt),
});

const seenAgain = (input: IngestInput, completed: RawListing, listing: Listing, vehicle: Vehicle): SeenAgain => {
  const completions = vehicleCompletions(completed, vehicle);
  const completesVehicle = Object.keys(completions).length > 0;
  const verdict =
    completesVehicle && isAwaitingDecision(vehicle)
      ? evaluate(
          completed,
          {
            ...input.info,
            price: completions.price ?? vehicle.price ?? undefined,
            km: completions.km ?? vehicle.km ?? undefined,
            year: completions.year ?? vehicle.year ?? undefined,
          },
          input.settings,
          vehicle.distanceKm,
        )
      : undefined;
  return {
    kind: 'seenAgain',
    vehicleId: listing.vehicleId,
    listingId: listing.id,
    listingChanges: listingCompletions(completed, listing, input.now),
    vehicleChanges: {
      ...completions,
      ...(verdict === undefined ? {} : { matched: verdict.pass, rejections: verdict.rejections }),
      lastSeenAt: input.now,
    },
    verdict,
  };
};

const knownListingSeen = (input: IngestInput, completed: RawListing, listing: Listing, vehicle: Vehicle): PriceChanged | SeenAgain =>
  completed.price !== undefined && listing.price !== null && completed.price !== listing.price
    ? priceChanged(completed, listing, vehicle, listing.price, completed.price, input.now)
    : seenAgain(input, completed, listing, vehicle);

const attachedToVehicle = (
  input: IngestInput,
  completed: RawListing,
  vehicle: Vehicle,
  listings: readonly Listing[],
): AttachedToVehicle => {
  const attachment = attachmentOf(listings, completed.site);
  const listing = newListing(completed, input.now);
  return {
    kind: 'attachedToVehicle',
    attachment,
    vehicleId: vehicle.id,
    newListing: listing,
    pricePoint: firstPricePoint(listing),
    vehicleChanges: {
      reposted: attachment === 'repost' || vehicle.reposted,
      ...publishedAtChange(vehicle.publishedAt, completed.publishedAt),
      lastSeenAt: input.now,
    },
    event: {
      type: attachment === 'repost' ? EVENT_TYPES.repostedOnSameSite : EVENT_TYPES.seenOnAnotherSite,
      detail: sightingDetail(completed.siteLabel, completed.url),
      at: input.now,
    },
  };
};

const created = (input: IngestInput, completed: RawListing, location: VehicleLocation): Created => {
  const { info, now } = input;
  const verdict = evaluate(completed, info, input.settings, location.distanceKm);
  const listing = newListing(completed, now);
  return {
    kind: 'created',
    listing: completed,
    vehicle: newVehicle(completed, info, location, verdict, {
      firstSeenAt: now,
      lastSeenAt: now,
      publishedAt: completed.publishedAt ?? null,
      reposted: false,
    }),
    verdict,
    newListing: listing,
    pricePoint: firstPricePoint(listing),
    event: { type: EVENT_TYPES.firstSeen, detail: completed.siteLabel, at: now },
  };
};

export function decideIngest(input: IngestInput): IngestDecision {
  const completed = completedFromTitle(input.listing, input.info);
  const { identification } = input;
  switch (identification.kind) {
    case 'knownListing':
      return knownListingSeen(input, completed, identification.listing, identification.vehicle);
    case 'knownVehicle':
      return attachedToVehicle(input, completed, identification.vehicle, identification.listings);
    case 'newVehicle':
      return created(input, completed, identification.location);
  }
}
