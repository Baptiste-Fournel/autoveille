import { describe } from 'vitest';
import { SqliteMailboxStateRepository } from '../../src/infrastructure/persistence/sqlite/sqliteMailboxStateRepository.js';
import { migratedSqliteDatabase } from '../support/migratedSqliteDatabase.js';
import { mailboxStateRepositoryContract } from './mailboxStateRepository.contract.js';

describe('MailboxStateRepository sur SQLite', () => {
  mailboxStateRepositoryContract(() => new SqliteMailboxStateRepository(migratedSqliteDatabase()));
});
