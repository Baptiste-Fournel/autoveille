import { earlierPublishedAt } from './earlierPublishedAt.js';
import type { Listing, Vehicle } from './types.js';

export interface VehicleShowcase {
  readonly publishedAt: string | null;
  readonly imageUrl: string | null;
  readonly description: string | null;
}

type ShownListing = Pick<Listing, 'publishedAt' | 'imageUrl' | 'description'>;

const earliestPublishedAt = (listings: readonly ShownListing[]): string | null =>
  listings.reduce<string | null>((earliest, listing) => earlierPublishedAt(earliest, listing.publishedAt ?? undefined) ?? earliest, null);

export const vehicleShowcase = (vehicle: Pick<Vehicle, 'publishedAt'>, listings: readonly ShownListing[]): VehicleShowcase => ({
  publishedAt: vehicle.publishedAt ?? earliestPublishedAt(listings),
  imageUrl: listings.find((listing) => listing.imageUrl)?.imageUrl ?? null,
  description: listings.find((listing) => listing.description)?.description ?? null,
});
