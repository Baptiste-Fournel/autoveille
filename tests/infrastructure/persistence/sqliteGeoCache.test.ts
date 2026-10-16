import { describe, expect, it } from 'vitest';
import type { GeocodingCache } from '../../../src/infrastructure/http/geocodingCache.js';
import { SqliteGeoCache } from '../../../src/infrastructure/persistence/sqlite/sqliteGeoCache.js';
import { migratedLegacyDatabase } from '../../support/migratedLegacyDatabase.js';
import { migratedSqliteDatabase } from '../../support/migratedSqliteDatabase.js';

describe('cache de géocodage enregistré dans SQLite', () => {
  it('Montauban, placée par l’ancienne application avec les coordonnées de geo.api.gouv.fr, est retrouvée dans le cache de la base migrée ; Cognac, jamais cherchée, n’y est pas', () => {
    // Given
    const cache = new SqliteGeoCache(migratedLegacyDatabase());

    // When
    const montauban = cache.get('montauban|82000');
    const cognac = cache.get('cognac|16100');

    // Then
    expect(montauban).toEqual({ lat: 44.0176, lon: 1.3756, precision: 'city' });
    expect(cognac).toBeUndefined();
  });

  it('Pessac placée par geo.api.gouv.fr est retrouvée telle quelle à la recherche suivante', () => {
    // Given
    const cache: GeocodingCache = new SqliteGeoCache(migratedSqliteDatabase());

    // When
    cache.set('pessac|33600', { lat: 44.8067, lon: -0.6311, precision: 'city' });

    // Then
    expect(cache.get('pessac|33600')).toEqual({ lat: 44.8067, lon: -0.6311, precision: 'city' });
  });

  it('la boîte mail et un import qui placent Langon en même temps l’enregistrent une seule fois, sans erreur', () => {
    // Given
    const database = migratedSqliteDatabase();
    const cache = new SqliteGeoCache(database);
    cache.set('langon|33210', { lat: 44.5547, lon: -0.2497, precision: 'city' });

    // When
    const placedAgain = (): void => cache.set('langon|33210', { lat: 44.5547, lon: -0.2497, precision: 'city' });

    // Then
    expect(placedAgain).not.toThrow();
    expect(database.prepare("SELECT COUNT(*) AS places FROM geo_cache WHERE key = 'langon|33210'").get()).toEqual({ places: 1 });
    expect(cache.get('langon|33210')).toEqual({ lat: 44.5547, lon: -0.2497, precision: 'city' });
  });
});
