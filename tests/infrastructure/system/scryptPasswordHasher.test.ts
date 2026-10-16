import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import Database from 'better-sqlite3';
import { describe, expect, it } from 'vitest';
import { scryptPasswordHasher } from '../../../src/infrastructure/system/scryptPasswordHasher.js';
import { buildLegacyDatabase, LEGACY_PASSWORD } from '../../fixtures/db/buildLegacyDatabase.js';

const passwordHashOfLegacyDatabase = (): string => {
  const directory = mkdtempSync(join(tmpdir(), 'autoveille-password-'));
  try {
    const file = join(directory, 'autoveille.sqlite');
    buildLegacyDatabase(file);
    const database = new Database(file, { readonly: true });
    try {
      const row: unknown = database.prepare("SELECT value FROM secrets WHERE key = 'password_hash'").get();
      return typeof row === 'object' && row !== null && 'value' in row && typeof row.value === 'string' ? row.value : '';
    } finally {
      database.close();
    }
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
};

describe('mot de passe de l’application haché par scrypt', () => {
  it('le mot de passe choisi avant la mise à jour, enregistré par l’ancienne application, ouvre toujours l’application', () => {
    // Given
    const storedBeforeUpdate = passwordHashOfLegacyDatabase();

    // When
    const accepted = scryptPasswordHasher.verify(LEGACY_PASSWORD, storedBeforeUpdate);
    const typo = scryptPasswordHasher.verify('mot-de-passe-de-tset', storedBeforeUpdate);

    // Then
    expect(accepted).toBe(true);
    expect(typo).toBe(false);
  });

  it('un mot de passe choisi à la première connexion est enregistré au format hérité « sel:hachage » et ouvre l’application', () => {
    // Given
    const chosen = 'Porsche 911 de 1973';

    // When
    const stored = scryptPasswordHasher.hash(chosen);

    // Then
    expect(stored).toMatch(/^[0-9a-f]{32}:[0-9a-f]{128}$/);
    expect(scryptPasswordHasher.verify(chosen, stored)).toBe(true);
    expect(scryptPasswordHasher.hash(chosen)).not.toBe(stored);
  });
});
