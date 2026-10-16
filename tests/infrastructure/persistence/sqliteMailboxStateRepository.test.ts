import { describe, expect, it } from 'vitest';
import { SqliteMailboxStateRepository } from '../../../src/infrastructure/persistence/sqlite/sqliteMailboxStateRepository.js';
import { migratedLegacyDatabase } from '../../support/migratedLegacyDatabase.js';

describe('état de la boîte mail enregistré dans SQLite', () => {
  it('après la mise à jour, la boîte reprend après l’email 189 sans relire l’email en erreur, et l’écran Sites montre la hausse de prix Leboncoin puis le récapitulatif La Centrale tronqué', () => {
    // Given
    const state = new SqliteMailboxStateRepository(migratedLegacyDatabase());

    // When
    const position = state.position('INBOX');
    const recent = state.recentlyProcessed(2);

    // Then
    expect(position).toEqual({ lastUid: 189, uidValidity: 1 });
    expect(state.isProcessed('uid-1-144')).toBe(true);
    expect(recent).toMatchObject([
      {
        messageId: '<20261006082033.18f3c9a5@alerte.leboncoin.fr>',
        uid: 189,
        site: 'leboncoin',
        listingCount: 1,
        summary: { listings: [{ title: 'Peugeot 205 GTI 1.9 130ch', price: 25900, km: 98000, year: 1990 }], ignored: 4, kind: 'new' },
        error: null,
        processedAt: '2026-10-06T08:25:50.019Z',
      },
      {
        messageId: '<0100019a709cb354-lc@mail-alerte.lacentrale.fr>',
        uid: 171,
        summary: { announced: 61, kind: 'new', moreUrl: 'https://www.lacentrale.fr/listing?customerFamilyCodes=PART' },
      },
    ]);
  });
});
