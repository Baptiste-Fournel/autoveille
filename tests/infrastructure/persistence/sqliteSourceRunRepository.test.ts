import { describe, expect, it } from 'vitest';
import { SqliteSourceRunRepository } from '../../../src/infrastructure/persistence/sqlite/sqliteSourceRunRepository.js';
import { migratedLegacyDatabase } from '../../support/migratedLegacyDatabase.js';

describe('passages des sources enregistrés dans SQLite', () => {
  it('l’accueil de la base de production migrée liste ses trois sources dans l’ordre de leur premier passage, le site refusé par son robots.txt en échec', () => {
    // Given
    const runs = new SqliteSourceRunRepository(migratedLegacyDatabase());

    // When
    const all = runs.all();

    // Then
    expect(all).toEqual([
      {
        source: 'http:p7q2m4cd',
        lastRunAt: '2026-09-20T09:00:01.377Z',
        ok: false,
        detail: 'Le robots.txt du site interdit la lecture automatique de cette page. Utilisez l’alerte email du site à la place.',
      },
      {
        source: 'email',
        lastRunAt: '2026-10-13T16:45:00.218Z',
        ok: true,
        detail: '0 email(s) lu(s), 0 annonce(s), 0 nouvelle(s) correspondant aux réglages',
      },
      {
        source: 'http:k3v9x2ab',
        lastRunAt: '2026-10-13T16:45:03.904Z',
        ok: true,
        detail: '1 annonce(s) lue(s) (données structurées). 0 nouvelle(s) correspondant aux réglages.',
      },
    ]);
  });
});
