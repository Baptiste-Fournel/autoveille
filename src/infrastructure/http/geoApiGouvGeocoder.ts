import type { GeocodedPlace, Geocoder, PlaceQuery } from '../../application/ports/geocoder.js';
import { fold } from '../../domain/parsing/text.js';
import { type DeadlineTimers, withDeadline } from './deadline.js';
import type { GeocodingCache } from './geocodingCache.js';
import { offlinePlace } from './offlineGeo.js';
import type { Web } from './web.js';

const COMMUNES_API = 'https://geo.api.gouv.fr/communes';

const COMMUNES_API_TIMEOUT_MS = 5_000;

const cacheKey = ({ city, postalCode }: PlaceQuery): string => `${fold(city ?? '')}|${postalCode ?? ''}`;

const communesQuery = ({ city, postalCode }: PlaceQuery): URLSearchParams =>
  new URLSearchParams({
    fields: 'centre,codesPostaux',
    limit: '1',
    boost: 'population',
    ...(city ? { nom: city } : {}),
    ...(postalCode ? { codePostal: postalCode } : {}),
  });

const isCoordinates = (value: unknown): value is readonly [number, number] =>
  Array.isArray(value) && typeof value[0] === 'number' && typeof value[1] === 'number';

const centreOfFirstCommune = (communes: unknown): GeocodedPlace | undefined => {
  const first: unknown = Array.isArray(communes) ? communes[0] : undefined;
  const centre: unknown = typeof first === 'object' && first !== null && 'centre' in first ? first.centre : undefined;
  const coordinates: unknown = typeof centre === 'object' && centre !== null && 'coordinates' in centre ? centre.coordinates : undefined;
  return isCoordinates(coordinates) ? { lat: coordinates[1], lon: coordinates[0], precision: 'city' } : undefined;
};

const communeCentre = async <Handle>(web: Web<Handle>, place: PlaceQuery): Promise<GeocodedPlace | undefined> => {
  const response = await withDeadline(web.timers, COMMUNES_API_TIMEOUT_MS, (signal) =>
    web.fetch(`${COMMUNES_API}?${communesQuery(place)}`, { signal }),
  );
  return response.ok ? centreOfFirstCommune(await response.json()) : undefined;
};

const onlineCentre = <Handle>(web: Web<Handle>, place: PlaceQuery): Promise<GeocodedPlace | undefined> =>
  communeCentre(web, place).catch(() => undefined);

export const geoApiGouvGeocoder = <Handle>(fetchImpl: typeof fetch, timers: DeadlineTimers<Handle>, cache: GeocodingCache): Geocoder => ({
  locate: async (place) => {
    if (!place.city && !place.postalCode) {
      return undefined;
    }
    const key = cacheKey(place);
    const cached = cache.get(key);
    if (cached !== undefined) {
      return cached;
    }
    const online = await onlineCentre({ fetch: fetchImpl, timers }, place);
    if (online !== undefined) {
      cache.set(key, online);
      return online;
    }
    const offline = offlinePlace(place);
    if (offline?.precision === 'city') {
      cache.set(key, offline);
    }
    return offline;
  },
});
