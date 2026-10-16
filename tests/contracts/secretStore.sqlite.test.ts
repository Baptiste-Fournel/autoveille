import { describe } from 'vitest';
import { SqliteSecretStore } from '../../src/infrastructure/persistence/sqlite/sqliteSecretStore.js';
import { migratedSqliteDatabase } from '../support/migratedSqliteDatabase.js';
import { secretStoreContract } from './secretStore.contract.js';

describe('SecretStore sur SQLite', () => {
  secretStoreContract(() => new SqliteSecretStore(migratedSqliteDatabase()));
});
