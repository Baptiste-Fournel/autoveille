import { describe } from 'vitest';
import { geoApiGouvGeocoder } from '../../src/infrastructure/http/geoApiGouvGeocoder.js';
import { SqliteGeoCache } from '../../src/infrastructure/persistence/sqlite/sqliteGeoCache.js';
import { manualTimers } from '../support/manualTimers.js';
import { migratedSqliteDatabase } from '../support/migratedSqliteDatabase.js';
import { simulatedWeb } from '../support/simulatedWeb.js';
import { geocoderContract } from './geocoder.contract.js';

describe('Geocoder geo.api.gouv.fr injoignable : table hors ligne, cache SQLite', () => {
  geocoderContract(() => geoApiGouvGeocoder(simulatedWeb({}).fetch, manualTimers(), new SqliteGeoCache(migratedSqliteDatabase())));
});
