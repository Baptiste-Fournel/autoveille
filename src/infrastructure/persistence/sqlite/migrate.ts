import { readdirSync, readFileSync } from 'node:fs';
import type Database from 'better-sqlite3';
import type { Clock } from '../../../application/ports/clock.js';
import { DatabaseNewerThanApplication } from './databaseNewerThanApplication.js';
import { addMissingLegacyColumns } from './legacyColumns.js';

interface Migration {
  readonly version: number;
  readonly file: string;
}

const MIGRATIONS_DIRECTORY = new URL('./migrations/', import.meta.url);

const MIGRATION_FILE = /^(\d+)_[a-z0-9_]+\.sql$/;

const INITIAL_SCHEMA_VERSION = 1;

const migrationOf = (file: string): readonly Migration[] => {
  const version = MIGRATION_FILE.exec(file)?.[1];
  return version === undefined ? [] : [{ version: Number(version), file }];
};

const knownMigrations = (): readonly Migration[] =>
  readdirSync(MIGRATIONS_DIRECTORY)
    .flatMap(migrationOf)
    .sort((left, right) => left.version - right.version);

const userVersion = (database: Database.Database): number => Number(database.pragma('user_version', { simple: true }));

const applyIfPending = (database: Database.Database, migration: Migration): void => {
  if (userVersion(database) >= migration.version) {
    return;
  }
  database.exec(readFileSync(new URL(migration.file, MIGRATIONS_DIRECTORY), 'utf8'));
  if (migration.version === INITIAL_SCHEMA_VERSION) {
    addMissingLegacyColumns(database);
  }
  database.pragma(`user_version = ${migration.version}`);
};

const refuseNewerDatabase = (database: Database.Database, migrations: readonly Migration[]): void => {
  const latestKnownVersion = migrations[migrations.length - 1]?.version ?? 0;
  const databaseVersion = userVersion(database);
  if (databaseVersion > latestKnownVersion) {
    throw new DatabaseNewerThanApplication(databaseVersion, latestKnownVersion);
  }
};

export function migrate(database: Database.Database, clock: Clock): void {
  const migrations = knownMigrations();
  refuseNewerDatabase(database, migrations);
  const migratedAt = clock.now();
  database.function('migration_instant', () => migratedAt);
  for (const migration of migrations) {
    database.transaction(() => applyIfPending(database, migration)).immediate();
  }
}
