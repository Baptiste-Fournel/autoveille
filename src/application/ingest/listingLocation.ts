import { locate, UNKNOWN_LOCATION, type VehicleLocation, zoneCenter } from '../../domain/ingest/location.js';
import type { Zone } from '../../domain/settings/types.js';
import type { RawListing } from '../../domain/vehicle/types.js';
import type { Geocoder } from '../ports/geocoder.js';

export async function locateListing(
  geocoder: Geocoder,
  zone: Zone,
  place: Pick<RawListing, 'city' | 'postalCode'>,
): Promise<VehicleLocation> {
  const center = zoneCenter(zone);
  return center === undefined
    ? UNKNOWN_LOCATION
    : locate(center, await geocoder.locate({ city: place.city, postalCode: place.postalCode }));
}
