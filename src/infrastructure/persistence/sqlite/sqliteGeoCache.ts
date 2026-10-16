import type Database from 'better-sqlite3';
import type { GeocodedPlace } from '../../../application/ports/geocoder.js';
import { cachedPlaceJsonOf, geocodedPlaceOf } from './geoCacheMapper.js';

interface GeoCacheRow {
  readonly json: string;
}

export class SqliteGeoCache {
  private readonly selectPlace: Database.Statement<[string], GeoCacheRow>;
  private readonly upsertPlace: Database.Statement<[string, string]>;

  constructor(database: Database.Database) {
    this.selectPlace = database.prepare<[string], GeoCacheRow>('SELECT json FROM geo_cache WHERE key = ?');
    this.upsertPlace = database.prepare<[string, string]>(
      'INSERT INTO geo_cache (key, json) VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET json = excluded.json',
    );
  }

  get(key: string): GeocodedPlace | undefined {
    const row = this.selectPlace.get(key);
    return row === undefined ? undefined : geocodedPlaceOf(row.json);
  }

  set(key: string, place: GeocodedPlace): void {
    this.upsertPlace.run(key, cachedPlaceJsonOf(place));
  }
}
