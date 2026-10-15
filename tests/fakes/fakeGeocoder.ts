import type { GeocodedPlace, Geocoder, PlaceQuery } from '../../src/application/ports/geocoder.js';
import type { LatLon } from '../../src/domain/geo/distance.js';
import { fold } from '../../src/domain/parsing/text.js';

export interface KnownCity extends LatLon {
  readonly city: string;
}

export interface KnownDepartment extends LatLon {
  readonly code: string;
}

export const BORDEAUX: KnownCity = { city: 'Bordeaux', lat: 44.8378, lon: -0.5792 };
export const MERIGNAC: KnownCity = { city: 'Mérignac', lat: 44.8386, lon: -0.6436 };
export const PESSAC: KnownCity = { city: 'Pessac', lat: 44.8067, lon: -0.6311 };
export const TALENCE: KnownCity = { city: 'Talence', lat: 44.808, lon: -0.5908 };
export const SAINT_MEDARD_EN_JALLES: KnownCity = { city: 'Saint-Médard-en-Jalles', lat: 44.8961, lon: -0.7206 };
export const LIBOURNE: KnownCity = { city: 'Libourne', lat: 44.915, lon: -0.2436 };
export const ARCACHON: KnownCity = { city: 'Arcachon', lat: 44.6586, lon: -1.1689 };
export const LANGON: KnownCity = { city: 'Langon', lat: 44.5547, lon: -0.2497 };
export const MONTAUBAN: KnownCity = { city: 'Montauban', lat: 44.0176, lon: 1.3551 };

export const GIRONDE: KnownDepartment = { code: '33', lat: 44.83, lon: -0.58 };

export const KNOWN_CITIES: readonly KnownCity[] = [
  BORDEAUX,
  MERIGNAC,
  PESSAC,
  TALENCE,
  SAINT_MEDARD_EN_JALLES,
  LIBOURNE,
  ARCACHON,
  LANGON,
  MONTAUBAN,
];

export interface FakeGeocoder extends Geocoder {
  readonly queries: () => readonly PlaceQuery[];
}

const DEPARTMENT_CODE_LENGTH = 2;

const located = (point: LatLon, precision: GeocodedPlace['precision']): GeocodedPlace => ({ lat: point.lat, lon: point.lon, precision });

export const fakeGeocoder = (
  cities: readonly KnownCity[] = KNOWN_CITIES,
  departments: readonly KnownDepartment[] = [GIRONDE],
): FakeGeocoder => {
  let queries: readonly PlaceQuery[] = [];
  const cityNamed = (name: string | undefined): KnownCity | undefined =>
    name ? cities.find((known) => fold(known.city) === fold(name)) : undefined;
  const departmentOf = (postalCode: string | undefined): KnownDepartment | undefined =>
    postalCode ? departments.find((known) => known.code === postalCode.slice(0, DEPARTMENT_CODE_LENGTH)) : undefined;
  return {
    locate: async (place) => {
      queries = [...queries, place];
      if (!place.city && !place.postalCode) {
        return undefined;
      }
      const city = cityNamed(place.city);
      if (city !== undefined) {
        return located(city, 'city');
      }
      const department = departmentOf(place.postalCode);
      return department === undefined ? undefined : located(department, 'department');
    },
    queries: () => queries,
  };
};
