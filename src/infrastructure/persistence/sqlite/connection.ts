import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import Database from 'better-sqlite3';

const IN_MEMORY = ':memory:';

export function openDatabase(file: string): Database.Database {
  if (file !== IN_MEMORY) {
    mkdirSync(dirname(file), { recursive: true });
  }
  const database = new Database(file);
  database.pragma('journal_mode = WAL');
  database.pragma('foreign_keys = ON');
  return database;
}
