import type { GeocodedPlace, GeocodingPrecision } from '../../../application/ports/geocoder.js';

type StoredPrecision = 'ville' | 'departement';

interface CachedPlace {
  readonly lat: number;
  readonly lon: number;
  readonly precision: StoredPrecision;
}

const PRECISION_OF_STORED: Readonly<Record<StoredPrecision, GeocodingPrecision>> = { ville: 'city', departement: 'department' };

const STORED_PRECISION_OF: Readonly<Record<GeocodingPrecision, StoredPrecision>> = { city: 'ville', department: 'departement' };

export const geocodedPlaceOf = (json: string): GeocodedPlace => {
  const cached: CachedPlace = JSON.parse(json);
  return { lat: cached.lat, lon: cached.lon, precision: PRECISION_OF_STORED[cached.precision] };
};

export const cachedPlaceJsonOf = (place: GeocodedPlace): string => {
  const cached: CachedPlace = { lat: place.lat, lon: place.lon, precision: STORED_PRECISION_OF[place.precision] };
  return JSON.stringify(cached);
};
