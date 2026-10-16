import { describe, expect, it } from 'vitest';
import { SqliteSessionRepository } from '../../../src/infrastructure/persistence/sqlite/sqliteSessionRepository.js';
import { LEGACY_SESSION_TOKENS } from '../../fixtures/db/buildLegacyDatabase.js';
import { migratedLegacyDatabase } from '../../support/migratedLegacyDatabase.js';
import { UPDATE_NIGHT } from '../../support/updateNight.js';

const SIX_MONTHS_AFTER_THE_UPDATE = '2027-04-14T03:00:00.000Z';

describe('sessions enregistrées dans SQLite', () => {
  it('les trois appareils connectés avant la mise à jour retrouvent leur session avec leur date de connexion, et le nettoyage du jour de la mise à jour les garde', () => {
    // Given
    const sessions = new SqliteSessionRepository(migratedLegacyDatabase());

    // When
    sessions.deleteExpired(UPDATE_NIGHT);

    // Then
    const found = LEGACY_SESSION_TOKENS.map((token) => sessions.find(token));
    expect(found.map((session) => [session?.createdAt, session?.expiresAt])).toEqual([
      ['2026-09-14T16:04:12.331Z', SIX_MONTHS_AFTER_THE_UPDATE],
      ['2026-09-14T16:40:55.908Z', SIX_MONTHS_AFTER_THE_UPDATE],
      ['2026-10-06T07:15:02.117Z', SIX_MONTHS_AFTER_THE_UPDATE],
    ]);
  });

  it('les appareils qui ne sont jamais revenus depuis la mise à jour sont déconnectés par le nettoyage du 14 avril, 180 jours après elle, et pas par celui de la veille', () => {
    // Given
    const sessions = new SqliteSessionRepository(migratedLegacyDatabase());
    sessions.deleteExpired('2027-04-13T03:00:00.000Z');
    const keptTheDayBefore = LEGACY_SESSION_TOKENS.map((token) => sessions.find(token) !== undefined);

    // When
    sessions.deleteExpired(SIX_MONTHS_AFTER_THE_UPDATE);

    // Then
    expect(keptTheDayBefore).toEqual([true, true, true]);
    expect(LEGACY_SESSION_TOKENS.map((token) => sessions.find(token))).toEqual([undefined, undefined, undefined]);
  });
});
