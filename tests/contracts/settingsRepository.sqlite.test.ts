import { describe } from 'vitest';
import { SqliteSettingsRepository } from '../../src/infrastructure/persistence/sqlite/sqliteSettingsRepository.js';
import { migratedSqliteDatabase } from '../support/migratedSqliteDatabase.js';
import { settingsRepositoryContract } from './settingsRepository.contract.js';

describe('SettingsRepository sur SQLite', () => {
  settingsRepositoryContract(() => new SqliteSettingsRepository(migratedSqliteDatabase()));
});
