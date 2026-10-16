import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { openDatabase } from '../../../src/infrastructure/persistence/sqlite/connection.js';

describe('ouverture de la base SQLite', () => {
  it('au premier démarrage sur le serveur, la base est créée dans un dossier data/ qui n’existe pas encore, en WAL, avec les clés étrangères actives', () => {
    // Given
    const root = mkdtempSync(join(tmpdir(), 'autoveille-connection-'));
    const file = join(root, 'data', 'autoveille.sqlite');

    try {
      // When
      const db = openDatabase(file);

      // Then
      expect(existsSync(file)).toBe(true);
      expect(db.pragma('journal_mode', { simple: true })).toBe('wal');
      expect(db.pragma('foreign_keys', { simple: true })).toBe(1);
      db.close();
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('une base en mémoire pour un test traversant s’ouvre sans fichier, avec les clés étrangères actives', () => {
    // Given
    const file = ':memory:';

    // When
    const db = openDatabase(file);

    // Then
    expect(db.memory).toBe(true);
    expect(db.pragma('foreign_keys', { simple: true })).toBe(1);
    db.close();
  });
});
