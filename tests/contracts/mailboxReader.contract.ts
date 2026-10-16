import { expect, it } from 'vitest';
import type { MailboxReader } from '../../src/application/ports/mailboxReader.js';
import { DEALER_MAILBOX } from '../support/dealerMailbox.js';
import { loadFixture } from '../support/fixtures.js';

export interface MailboxEmail {
  readonly uid: number;
  readonly receivedAt: string;
  readonly source: string;
}

export interface MailboxContent {
  readonly uidValidity: number;
  readonly emails: readonly MailboxEmail[];
}

const THREE_ALERTS: readonly MailboxEmail[] = [
  { uid: 41, receivedAt: '2026-10-11T19:02:11.000Z', source: 'alerte Leboncoin' },
  { uid: 42, receivedAt: '2026-10-12T06:12:44.000Z', source: 'alerte La Centrale' },
  { uid: 43, receivedAt: '2026-10-15T05:48:09.000Z', source: 'alerte ParuVendu' },
];

const ALERTS_MAILBOX: MailboxContent = { uidValidity: 7, emails: THREE_ALERTS };

export function mailboxReaderContract(create: (mailbox: MailboxContent) => MailboxReader): void {
  it('la boîte des alertes ouverte annonce son uidValidity et le nombre d’emails qu’elle contient', async () => {
    // Given
    const reader = create(ALERTS_MAILBOX);

    // When
    const session = await reader.open(DEALER_MAILBOX);

    // Then
    expect({ uidValidity: session.uidValidity, messageCount: session.messageCount }).toEqual({ uidValidity: 7, messageCount: 3 });
  });

  it('deux emails arrivés depuis le dernier lu (UID 41) : les UID 42 et 43 sont à lire, dans l’ordre', async () => {
    // Given
    const session = await create(ALERTS_MAILBOX).open(DEALER_MAILBOX);

    // When
    const uids = await session.uidsAfter(41);

    // Then
    expect(uids).toEqual([42, 43]);
  });

  it('aucun email arrivé depuis le dernier lu (UID 43) : rien à lire, le 43 n’est pas relu', async () => {
    // Given
    const session = await create(ALERTS_MAILBOX).open(DEALER_MAILBOX);

    // When
    const uids = await session.uidsAfter(43);

    // Then
    expect(uids).toEqual([]);
  });

  it('première lecture, trois jours en arrière depuis le 15 octobre à 8 h 30 : les emails reçus depuis le 12 octobre, celui de 6 h 12 le 12 compris (recherche au jour près)', async () => {
    // Given
    const session = await create(ALERTS_MAILBOX).open(DEALER_MAILBOX);

    // When
    const uids = await session.uidsSince('2026-10-12T08:30:00.000Z');

    // Then
    expect(uids).toEqual([42, 43]);
  });

  it('un email d’alerte ParuVendu se relit tel que la boîte l’a reçu, pour être décodé ensuite', async () => {
    // Given
    const source = loadFixture('emails/paruvendu/une-nouvelle-annonce.eml');
    const session = await create({ uidValidity: 7, emails: [{ uid: 44, receivedAt: '2026-10-15T06:05:12.000Z', source }] }).open(
      DEALER_MAILBOX,
    );

    // When
    const read = await session.read(44);

    // Then
    expect(new TextDecoder().decode(read)).toBe(source);
  });

  it('un email supprimé sur le téléphone entre la recherche et la lecture : il n’y a rien à lire', async () => {
    // Given
    const session = await create(ALERTS_MAILBOX).open(DEALER_MAILBOX);

    // When
    const read = await session.read(44);

    // Then
    expect(read).toBeUndefined();
  });
}
