import { haversineKm, type LatLon } from '../geo/distance.js';
import type { Zone } from '../settings/types.js';

export interface VehicleLocation {
  readonly lat: number | null;
  readonly lon: number | null;
  readonly distanceKm: number | null;
}

export const UNKNOWN_LOCATION: VehicleLocation = { lat: null, lon: null, distanceKm: null };

export const zoneCenter = (zone: Pick<Zone, 'lat' | 'lon'>): LatLon | undefined =>
  zone.lat === null || zone.lon === null ? undefined : { lat: zone.lat, lon: zone.lon };

export const locate = (center: LatLon, place: LatLon | undefined): VehicleLocation =>
  place === undefined ? UNKNOWN_LOCATION : { lat: place.lat, lon: place.lon, distanceKm: haversineKm(center, place) };
