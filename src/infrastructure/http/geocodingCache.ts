import type { GeocodedPlace } from '../../application/ports/geocoder.js';

export interface GeocodingCache {
  get(key: string): GeocodedPlace | undefined;
  set(key: string, place: GeocodedPlace): void;
}
