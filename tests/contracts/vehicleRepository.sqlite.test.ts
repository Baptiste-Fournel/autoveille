import { describe } from 'vitest';
import { SqliteVehicleRepository } from '../../src/infrastructure/persistence/sqlite/sqliteVehicleRepository.js';
import { migratedSqliteDatabase } from '../support/migratedSqliteDatabase.js';
import { vehicleRepositoryContract } from './vehicleRepository.contract.js';

describe('VehicleRepository sur SQLite', () => {
  vehicleRepositoryContract(() => new SqliteVehicleRepository(migratedSqliteDatabase()));
});
