import type { Listing, RawListing, Vehicle } from './types.js';

export const rawListingOf = (vehicle: Vehicle, firstListing: Listing): RawListing => ({
  site: firstListing.site,
  siteLabel: firstListing.siteLabel,
  externalId: firstListing.externalId,
  url: firstListing.url,
  title: firstListing.title,
  price: vehicle.price ?? undefined,
  km: vehicle.km ?? undefined,
  year: vehicle.year ?? undefined,
  city: vehicle.city ?? undefined,
  postalCode: vehicle.postalCode ?? undefined,
  sellerType: firstListing.sellerType,
});
