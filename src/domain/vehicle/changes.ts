import type { Verdict } from '../filtering/verdict.js';
import { fingerprint } from './identity.js';
import type { Listing, RawListing, Vehicle, VehicleInfo } from './types.js';

export type NewVehicle = Omit<Vehicle, 'id'>;

export type VehicleSightingChanges = Partial<
  Pick<Vehicle, 'price' | 'priceDropped' | 'km' | 'year' | 'publishedAt' | 'reposted' | 'matched' | 'rejections' | 'lastSeenAt'>
>;

export type RegroupingChanges = Partial<Pick<Vehicle, 'make' | 'model' | 'family' | 'fingerprint' | 'reposted' | 'matched' | 'rejections'>>;

export type VehicleUpdateChanges = Partial<
  Pick<Vehicle, 'status' | 'doNotContact' | 'messageOverride' | 'note' | 'matched' | 'rejections'>
>;

export type NewListing = Omit<Listing, 'id' | 'vehicleId'>;

export type ListingChanges = Partial<Pick<Listing, 'price' | 'imageUrl' | 'description' | 'publishedAt' | 'lastSeenAt'>>;

export type VehiclePlace = Pick<Vehicle, 'lat' | 'lon' | 'distanceKm'>;

export type VehicleSightings = Pick<Vehicle, 'firstSeenAt' | 'lastSeenAt' | 'publishedAt' | 'reposted'>;

export const newListing = (raw: RawListing, seenAt: string): NewListing => ({
  site: raw.site,
  siteLabel: raw.siteLabel,
  externalId: raw.externalId,
  url: raw.url,
  title: raw.title,
  price: raw.price ?? null,
  km: raw.km ?? null,
  year: raw.year ?? null,
  city: raw.city ?? null,
  postalCode: raw.postalCode ?? null,
  sellerType: raw.sellerType ?? 'inconnu',
  imageUrl: raw.imageUrl ?? null,
  description: raw.description?.trim() || null,
  publishedAt: raw.publishedAt ?? null,
  sourceRef: raw.sourceRef ?? null,
  firstSeenAt: seenAt,
  lastSeenAt: seenAt,
});

export const newVehicle = (
  raw: RawListing,
  info: VehicleInfo,
  place: VehiclePlace,
  verdict: Verdict,
  sightings: VehicleSightings,
): NewVehicle => ({
  fingerprint: fingerprint(info, raw),
  make: info.make ?? null,
  model: info.model ?? null,
  family: info.family,
  year: info.year ?? null,
  km: info.km ?? null,
  price: info.price ?? null,
  city: raw.city ?? null,
  postalCode: raw.postalCode ?? null,
  lat: place.lat,
  lon: place.lon,
  distanceKm: place.distanceKm,
  status: 'nouveau',
  doNotContact: false,
  matched: verdict.pass,
  rejections: verdict.rejections,
  messageOverride: null,
  note: null,
  firstSeenAt: sightings.firstSeenAt,
  lastSeenAt: sightings.lastSeenAt,
  publishedAt: sightings.publishedAt,
  notifiedAt: null,
  priceDropped: false,
  reposted: sightings.reposted,
});
