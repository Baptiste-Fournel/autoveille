import type Database from 'better-sqlite3';
import type { Clock } from '../../src/application/ports/clock.js';
import { openDatabase } from '../../src/infrastructure/persistence/sqlite/connection.js';
import { migrate } from '../../src/infrastructure/persistence/sqlite/migrate.js';
import { fakeClock } from '../fakes/fakeClock.js';

export const migratedSqliteDatabase = (file = ':memory:', clock: Clock = fakeClock()): Database.Database => {
  const database = openDatabase(file);
  migrate(database, clock);
  return database;
};
