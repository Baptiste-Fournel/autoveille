import { describe } from 'vitest';
import { SqlitePushSubscriptionRepository } from '../../src/infrastructure/persistence/sqlite/sqlitePushSubscriptionRepository.js';
import { migratedSqliteDatabase } from '../support/migratedSqliteDatabase.js';
import { pushSubscriptionRepositoryContract } from './pushSubscriptionRepository.contract.js';

describe('PushSubscriptionRepository sur SQLite', () => {
  pushSubscriptionRepositoryContract(() => new SqlitePushSubscriptionRepository(migratedSqliteDatabase()));
});
