import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import Database from 'better-sqlite3';
import { buildLegacyDatabase } from '../fixtures/db/buildLegacyDatabase.js';
import { migratedSqliteDatabase } from './migratedSqliteDatabase.js';
import { updateNightClock } from './updateNight.js';

export function migratedLegacyDatabase(): Database.Database {
  const directory = mkdtempSync(join(tmpdir(), 'autoveille-legacy-'));
  try {
    const file = join(directory, 'autoveille.sqlite');
    buildLegacyDatabase(file);
    const onDisk = migratedSqliteDatabase(file, updateNightClock());
    try {
      onDisk.pragma('journal_mode = DELETE');
      const inMemory = new Database(onDisk.serialize());
      inMemory.pragma('foreign_keys = ON');
      return inMemory;
    } finally {
      onDisk.close();
    }
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}
