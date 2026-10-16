import { timingSafeEqual } from 'node:crypto';
import type Database from 'better-sqlite3';
import type { SecretKey, SecretStore } from '../../../application/ports/secretStore.js';

interface SecretRow {
  readonly value: string;
}

const sameSecret = (expected: string | undefined, candidate: string): boolean => {
  if (!expected || !candidate) {
    return false;
  }
  const expectedBytes = Buffer.from(expected);
  const candidateBytes = Buffer.from(candidate);
  return candidateBytes.length === expectedBytes.length && timingSafeEqual(candidateBytes, expectedBytes);
};

export class SqliteSecretStore implements SecretStore {
  private readonly selectSecret: Database.Statement<[SecretKey], SecretRow>;
  private readonly upsertSecret: Database.Statement<[SecretKey, string]>;

  constructor(database: Database.Database) {
    this.selectSecret = database.prepare<[SecretKey], SecretRow>('SELECT value FROM secrets WHERE key = ?');
    this.upsertSecret = database.prepare<[SecretKey, string]>(
      'INSERT INTO secrets (key, value) VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value',
    );
  }

  get(key: SecretKey): string | undefined {
    return this.selectSecret.get(key)?.value;
  }

  set(key: SecretKey, value: string): void {
    this.upsertSecret.run(key, value);
  }

  matches(key: SecretKey, candidate: string): boolean {
    return sameSecret(this.get(key), candidate);
  }
}
