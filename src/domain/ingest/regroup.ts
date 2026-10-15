import { evaluate } from '../filtering/evaluate.js';
import { sameRejections, type Verdict } from '../filtering/verdict.js';
import { type ExtractionContext, extractVehicleInfo } from '../parsing/vehicleInfo.js';
import { customBrandsOf } from '../settings/customBrands.js';
import type { Settings } from '../settings/types.js';
import { type NewVehicle, newVehicle, type VehicleChanges } from '../vehicle/changes.js';
import { EVENT_TYPES, type NewVehicleEvent } from '../vehicle/events.js';
import { fingerprint, type KmAndPrice, similar } from '../vehicle/identity.js';
import { isAwaitingDecision } from '../vehicle/status.js';
import type { Listing, RawListing, Vehicle, VehicleInfo } from '../vehicle/types.js';
import type { VehicleLocation } from './location.js';

export interface ListingReading {
  readonly stored: Listing;
  readonly raw: RawListing;
  readonly info: VehicleInfo;
  readonly fingerprint: string;
}

export interface SeparatedListings {
  readonly anchor: ListingReading;
  readonly listings: readonly Listing[];
}

export interface Regrouping {
  readonly vehicleChanges: VehicleChanges;
  readonly renamed: boolean;
  readonly reevaluated: boolean;
  readonly separated: readonly SeparatedListings[];
}

export interface SeparatedVehicle {
  readonly vehicle: NewVehicle;
  readonly listingIds: readonly number[];
  readonly event: NewVehicleEvent;
}

interface Group {
  readonly anchor: ListingReading;
  readonly readings: readonly ListingReading[];
}

const rawOf = (listing: Listing, vehicle: Vehicle): RawListing => ({
  site: listing.site,
  siteLabel: listing.siteLabel,
  externalId: listing.externalId,
  url: listing.url,
  title: listing.title,
  price: listing.price ?? undefined,
  km: listing.km ?? undefined,
  year: listing.year ?? vehicle.year ?? undefined,
  city: listing.city ?? vehicle.city ?? undefined,
  postalCode: listing.postalCode ?? vehicle.postalCode ?? undefined,
  sellerType: listing.sellerType,
  description: listing.description ?? undefined,
  publishedAt: listing.publishedAt ?? undefined,
});

const readingOf = (listing: Listing, vehicle: Vehicle, context: ExtractionContext): ListingReading => {
  const raw = rawOf(listing, vehicle);
  const info = extractVehicleInfo(raw, context);
  return { stored: listing, raw, info, fingerprint: fingerprint(info, raw) };
};

const kmAndPriceOrVehicle = (listing: Listing, vehicle: Vehicle): KmAndPrice => ({
  km: listing.km ?? vehicle.km,
  price: listing.price ?? vehicle.price,
});

const staysWithAnchor = (reading: ListingReading, anchor: ListingReading, vehicle: Vehicle): boolean =>
  reading.fingerprint === anchor.fingerprint &&
  similar(kmAndPriceOrVehicle(reading.stored, vehicle), kmAndPriceOrVehicle(anchor.stored, vehicle));

const joinsGroup = (reading: ListingReading, group: Group): boolean =>
  reading.fingerprint === group.anchor.fingerprint && similar(reading.stored, group.anchor.stored);

const withReading = (groups: readonly Group[], reading: ListingReading): readonly Group[] => {
  const index = groups.findIndex((group) => joinsGroup(reading, group));
  return index === -1
    ? [...groups, { anchor: reading, readings: [reading] }]
    : groups.map((group, position) => (position === index ? { ...group, readings: [...group.readings, reading] } : group));
};

const groupedBySameCar = (readings: readonly ListingReading[], groups: readonly Group[]): readonly Group[] => {
  const [reading, ...rest] = readings;
  return reading === undefined ? groups : groupedBySameCar(rest, withReading(groups, reading));
};

const hasRepost = (listings: readonly Pick<Listing, 'site'>[]): boolean =>
  new Set(listings.map((listing) => listing.site)).size < listings.length;

const changedVerdict = (vehicle: Vehicle, verdict: Verdict): Verdict | undefined =>
  verdict.pass !== vehicle.matched || !sameRejections(verdict.rejections, vehicle.rejections) ? verdict : undefined;

export function regroupListings(
  vehicle: Vehicle,
  listingsInOrderRead: readonly Listing[],
  settings: Settings,
  currentYear: number,
): Regrouping | undefined {
  const context: ExtractionContext = { customBrands: customBrandsOf(settings), currentYear };
  const [anchor, ...others] = listingsInOrderRead.map((listing) => readingOf(listing, vehicle, context));
  if (anchor === undefined) {
    return undefined;
  }
  const placed = others.map((reading) => ({ reading, stays: staysWithAnchor(reading, anchor, vehicle) }));
  const staying = [anchor, ...placed.filter(({ stays }) => stays).map(({ reading }) => reading)];
  const groups = groupedBySameCar(
    placed.filter(({ stays }) => !stays).map(({ reading }) => reading),
    [],
  );
  const info: VehicleInfo = {
    make: anchor.info.make ?? vehicle.make ?? undefined,
    model: anchor.info.model,
    family: anchor.info.make ? anchor.info.family : vehicle.family,
    year: vehicle.year ?? undefined,
    km: vehicle.km ?? undefined,
    price: vehicle.price ?? undefined,
  };
  const renamed = (info.make ?? null) !== vehicle.make || (info.model ?? null) !== vehicle.model;
  const reposted = hasRepost(staying.map((reading) => reading.stored));
  const refreshed = isAwaitingDecision(vehicle)
    ? changedVerdict(vehicle, evaluate(anchor.raw, info, settings, vehicle.distanceKm))
    : undefined;
  return {
    vehicleChanges: {
      ...(renamed ? { make: info.make ?? null, model: info.model ?? null } : {}),
      ...(info.family === vehicle.family ? {} : { family: info.family }),
      ...(anchor.fingerprint === vehicle.fingerprint ? {} : { fingerprint: anchor.fingerprint }),
      ...(reposted === vehicle.reposted ? {} : { reposted }),
      ...(refreshed === undefined ? {} : { matched: refreshed.pass, rejections: refreshed.rejections }),
    },
    renamed,
    reevaluated: refreshed !== undefined,
    separated: groups.map((group) => ({ anchor: group.anchor, listings: group.readings.map((reading) => reading.stored) })),
  };
}

export function vehicleOfSeparatedListings(group: SeparatedListings, location: VehicleLocation, settings: Settings): SeparatedVehicle {
  const { anchor, listings } = group;
  const verdict = evaluate(anchor.raw, anchor.info, settings, location.distanceKm);
  const publishedDates = listings.flatMap((listing) => (listing.publishedAt ? [listing.publishedAt] : []));
  return {
    vehicle: newVehicle(anchor.raw, anchor.info, location, verdict, {
      firstSeenAt: anchor.stored.firstSeenAt,
      lastSeenAt:
        listings
          .map((listing) => listing.lastSeenAt)
          .sort()
          .pop() ?? anchor.stored.lastSeenAt,
      publishedAt: publishedDates.sort()[0] ?? null,
      reposted: hasRepost(listings),
    }),
    listingIds: listings.map((listing) => listing.id),
    event: { type: EVENT_TYPES.firstSeen, detail: anchor.stored.siteLabel, at: anchor.stored.firstSeenAt },
  };
}
