import { describe } from 'vitest';
import { sqliteTransaction } from '../../src/infrastructure/persistence/sqlite/sqliteTransaction.js';
import { SqliteVehicleRepository } from '../../src/infrastructure/persistence/sqlite/sqliteVehicleRepository.js';
import { migratedSqliteDatabase } from '../support/migratedSqliteDatabase.js';
import { transactionContract } from './transaction.contract.js';

describe('Transaction sur SQLite', () => {
  transactionContract(() => {
    const database = migratedSqliteDatabase();
    return { transaction: sqliteTransaction(database), vehicles: new SqliteVehicleRepository(database) };
  });
});
