import { describe } from 'vitest';
import { SqliteSessionRepository } from '../../src/infrastructure/persistence/sqlite/sqliteSessionRepository.js';
import { migratedSqliteDatabase } from '../support/migratedSqliteDatabase.js';
import { sessionRepositoryContract } from './sessionRepository.contract.js';

describe('SessionRepository sur SQLite', () => {
  sessionRepositoryContract(() => new SqliteSessionRepository(migratedSqliteDatabase()));
});
