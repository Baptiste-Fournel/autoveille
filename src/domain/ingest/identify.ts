import { type KmAndPrice, similar } from '../vehicle/identity.js';
import type { Listing, Vehicle } from '../vehicle/types.js';
import type { VehicleLocation } from './location.js';

export type Identification =
  | { readonly kind: 'knownListing'; readonly listing: Listing; readonly vehicle: Vehicle }
  | { readonly kind: 'knownVehicle'; readonly vehicle: Vehicle; readonly listings: readonly Listing[] }
  | { readonly kind: 'newVehicle'; readonly location: VehicleLocation };

export type Attachment = 'repost' | 'otherSite';

export const sameVehicleAmong = (candidatesMostRecentlySeenFirst: readonly Vehicle[], info: KmAndPrice): Vehicle | undefined =>
  candidatesMostRecentlySeenFirst.find((candidate) => similar(candidate, info));

export const attachmentOf = (listingsOfVehicle: readonly Pick<Listing, 'site'>[], site: string): Attachment =>
  listingsOfVehicle.some((listing) => listing.site === site) ? 'repost' : 'otherSite';
