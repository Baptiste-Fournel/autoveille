import type { LatLon } from '../../domain/geo/distance.js';

export interface PlaceQuery {
  readonly city?: string;
  readonly postalCode?: string;
}

export type GeocodingPrecision = 'city' | 'department';

export interface GeocodedPlace extends LatLon {
  readonly precision: GeocodingPrecision;
}

export interface Geocoder {
  locate(place: PlaceQuery): Promise<GeocodedPlace | undefined>;
}
