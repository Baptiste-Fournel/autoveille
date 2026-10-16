import { describe } from 'vitest';
import { SqliteSourceRunRepository } from '../../src/infrastructure/persistence/sqlite/sqliteSourceRunRepository.js';
import { migratedSqliteDatabase } from '../support/migratedSqliteDatabase.js';
import { sourceRunRepositoryContract } from './sourceRunRepository.contract.js';

describe('SourceRunRepository sur SQLite', () => {
  sourceRunRepositoryContract(() => new SqliteSourceRunRepository(migratedSqliteDatabase()));
});
