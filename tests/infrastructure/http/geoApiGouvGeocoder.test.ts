import { describe, expect, it, vi } from 'vitest';
import type { GeocodedPlace } from '../../../src/application/ports/geocoder.js';
import { geoApiGouvGeocoder } from '../../../src/infrastructure/http/geoApiGouvGeocoder.js';
import type { GeocodingCache } from '../../../src/infrastructure/http/geocodingCache.js';
import { SqliteGeoCache } from '../../../src/infrastructure/persistence/sqlite/sqliteGeoCache.js';
import { manualTimers } from '../../support/manualTimers.js';
import { migratedLegacyDatabase } from '../../support/migratedLegacyDatabase.js';
import { answering, silentUntilAborted, simulatedWeb } from '../../support/simulatedWeb.js';

interface MemoryCache extends GeocodingCache {
  readonly entries: () => ReadonlyMap<string, GeocodedPlace>;
}

const memoryCache = (initial: Readonly<Record<string, GeocodedPlace>> = {}): MemoryCache => {
  const places = new Map(Object.entries(initial));
  return {
    get: (key) => places.get(key),
    set: (key, place) => {
      places.set(key, place);
    },
    entries: () => places,
  };
};

const communesSearch = (query: string): string =>
  `https://geo.api.gouv.fr/communes?fields=centre%2CcodesPostaux&limit=1&boost=population&${query}`;

const PESSAC_SEARCH = communesSearch('nom=Pessac&codePostal=33600');

const PESSAC_COMMUNE = JSON.stringify([
  { nom: 'Pessac', code: '33318', codesPostaux: ['33600'], centre: { type: 'Point', coordinates: [-0.6311, 44.8067] } },
]);

const SAINT_MEDARD_SEARCH = communesSearch('nom=Saint-M%C3%A9dard-en-Jalles&codePostal=33160');

describe('géocodage par geo.api.gouv.fr, avec repli hors ligne et cache', () => {
  it('Pessac 33600, jamais cherchée : geo.api.gouv.fr la place au centre de la commune, et le cache la garde', async () => {
    // Given
    const web = simulatedWeb({ [PESSAC_SEARCH]: answering(PESSAC_COMMUNE, 200, { 'content-type': 'application/json' }) });
    const cache = memoryCache();

    // When
    const place = await geoApiGouvGeocoder(web.fetch, manualTimers(), cache).locate({ city: 'Pessac', postalCode: '33600' });

    // Then
    expect(place).toEqual({ lat: 44.8067, lon: -0.6311, precision: 'city' });
    expect(web.requested()).toEqual([PESSAC_SEARCH]);
    expect(cache.entries().get('pessac|33600')).toEqual({ lat: 44.8067, lon: -0.6311, precision: 'city' });
  });

  it('Mérignac déjà placée lors d’une annonce précédente n’est pas redemandée à geo.api.gouv.fr', async () => {
    // Given
    const web = simulatedWeb({});
    const cache = memoryCache({ 'merignac|33700': { lat: 44.8386, lon: -0.6436, precision: 'city' } });

    // When
    const place = await geoApiGouvGeocoder(web.fetch, manualTimers(), cache).locate({ city: 'Mérignac', postalCode: '33700' });

    // Then
    expect(place).toEqual({ lat: 44.8386, lon: -0.6436, precision: 'city' });
    expect(web.requested()).toEqual([]);
  });

  it('geo.api.gouv.fr injoignable : Saint-Médard-en-Jalles est placée grâce à la table hors ligne, et gardée en cache', async () => {
    // Given
    const web = simulatedWeb({});
    const cache = memoryCache();

    // When
    const place = await geoApiGouvGeocoder(web.fetch, manualTimers(), cache).locate({
      city: 'Saint-Médard-en-Jalles',
      postalCode: '33160',
    });

    // Then
    expect(place).toEqual({ lat: 44.8961, lon: -0.7206, precision: 'city' });
    expect(web.requested()).toEqual([SAINT_MEDARD_SEARCH]);
    expect(cache.entries().get('saint medard en jalles|33160')).toEqual({ lat: 44.8961, lon: -0.7206, precision: 'city' });
  });

  it('geo.api.gouv.fr qui ne répond pas est attendu cinq secondes, puis la ville est placée hors ligne', async () => {
    // Given
    const timers = manualTimers();
    const web = simulatedWeb({ [PESSAC_SEARCH]: silentUntilAborted });
    const outcome = vi.fn();

    // When
    void geoApiGouvGeocoder(web.fetch, timers, memoryCache()).locate({ city: 'Pessac', postalCode: '33600' }).then(outcome);
    await timers.elapse(4_999);
    const beforeFiveSeconds = outcome.mock.calls.length;
    await timers.elapse(1);

    // Then
    expect(beforeFiveSeconds).toBe(0);
    expect(outcome).toHaveBeenCalledWith({ lat: 44.8067, lon: -0.6311, precision: 'city' });
  });

  it('un village de Gironde absent de la table, geo.api.gouv.fr en panne : placé au centre du département, sans être mis en cache', async () => {
    // Given
    const web = simulatedWeb({
      [communesSearch('nom=Saint-Laurent-M%C3%A9doc&codePostal=33112')]: answering('Internal Server Error', 500),
    });
    const cache = memoryCache();

    // When
    const place = await geoApiGouvGeocoder(web.fetch, manualTimers(), cache).locate({ city: 'Saint-Laurent-Médoc', postalCode: '33112' });

    // Then
    expect(place).toEqual({ lat: 44.83, lon: -0.58, precision: 'department' });
    expect(cache.entries().size).toBe(0);
  });

  it('une ville que ni geo.api.gouv.fr ni la table ne connaissent, sans code postal : introuvable', async () => {
    // Given
    const web = simulatedWeb({ [communesSearch('nom=Bordeaux-Lac')]: answering('[]', 200, { 'content-type': 'application/json' }) });
    const cache = memoryCache();

    // When
    const place = await geoApiGouvGeocoder(web.fetch, manualTimers(), cache).locate({ city: 'Bordeaux-Lac' });

    // Then
    expect(place).toBeUndefined();
    expect(cache.entries().size).toBe(0);
  });

  it('une annonce sans ville ni code postal : aucune recherche', async () => {
    // Given
    const web = simulatedWeb({});

    // When
    const place = await geoApiGouvGeocoder(web.fetch, manualTimers(), memoryCache()).locate({});

    // Then
    expect(place).toBeUndefined();
    expect(web.requested()).toEqual([]);
  });
});

describe('géocodage composé avec le cache de la base, comme le câblera le démarrage', () => {
  it('Angoulême, placée par l’ancienne application, est retrouvée dans la base migrée sans rien demander à geo.api.gouv.fr', async () => {
    // Given
    const web = simulatedWeb({});
    const geocoder = geoApiGouvGeocoder(web.fetch, manualTimers(), new SqliteGeoCache(migratedLegacyDatabase()));

    // When
    const place = await geocoder.locate({ city: 'Angoulême', postalCode: '16000' });

    // Then
    expect(place).toEqual({ lat: 45.6484, lon: 0.1562, precision: 'city' });
    expect(web.requested()).toEqual([]);
  });

  it('Cognac, jamais cherchée, est placée par geo.api.gouv.fr puis enregistrée dans la base au format de l’ancienne application, et n’est plus redemandée', async () => {
    // Given
    const cognacSearch = communesSearch('nom=Cognac&codePostal=16100');
    const web = simulatedWeb({
      [cognacSearch]: answering(
        JSON.stringify([
          { nom: 'Cognac', code: '16102', codesPostaux: ['16100'], centre: { type: 'Point', coordinates: [-0.3292, 45.6958] } },
        ]),
        200,
        { 'content-type': 'application/json' },
      ),
    });
    const database = migratedLegacyDatabase();
    const geocoder = geoApiGouvGeocoder(web.fetch, manualTimers(), new SqliteGeoCache(database));

    // When
    const first = await geocoder.locate({ city: 'Cognac', postalCode: '16100' });
    const second = await geocoder.locate({ city: 'Cognac', postalCode: '16100' });

    // Then
    expect(first).toEqual({ lat: 45.6958, lon: -0.3292, precision: 'city' });
    expect(second).toEqual(first);
    expect(web.requested()).toEqual([cognacSearch]);
    expect(database.prepare("SELECT json FROM geo_cache WHERE key = 'cognac|16100'").get()).toEqual({
      json: '{"lat":45.6958,"lon":-0.3292,"precision":"ville"}',
    });
  });
});
