import type Database from 'better-sqlite3';
import type { Transaction } from '../../../application/ports/transaction.js';

export const sqliteTransaction = (database: Database.Database): Transaction => ({
  run: (work) => database.transaction(work)(),
});
