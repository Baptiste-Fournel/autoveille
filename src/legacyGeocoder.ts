import type { Geocoder, GeocodingPrecision } from './application/ports/geocoder.js';
import type { Store } from './db.js';
import { type GeoCache, type GeocodeResult, geocode } from './geo/geo.js';

const PRECISIONS: Readonly<Record<GeocodeResult['precision'], GeocodingPrecision>> = { ville: 'city', departement: 'department' };

const isGeocodeResult = (value: unknown): value is GeocodeResult =>
  typeof value === 'object' &&
  value !== null &&
  'lat' in value &&
  typeof value.lat === 'number' &&
  'lon' in value &&
  typeof value.lon === 'number' &&
  'precision' in value &&
  (value.precision === 'ville' || value.precision === 'departement') &&
  'source' in value &&
  (value.source === 'api' || value.source === 'offline' || value.source === 'cache');

export const storeGeoCache = (store: Store): GeoCache => ({
  get: (key) => {
    const cached = store.geoGet(key);
    return isGeocodeResult(cached) ? cached : undefined;
  },
  set: (key, value) => store.geoSet(key, value),
});

export const legacyGeocoder = (cache?: GeoCache): Geocoder => ({
  locate: async ({ city, postalCode }) => {
    const found = await geocode(city, postalCode, cache);
    return found === undefined ? undefined : { lat: found.lat, lon: found.lon, precision: PRECISIONS[found.precision] };
  },
});
