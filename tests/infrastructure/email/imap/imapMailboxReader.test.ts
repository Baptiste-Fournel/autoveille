import { describe, expect, it } from 'vitest';
import { MailboxUnavailable } from '../../../../src/application/ports/mailboxUnavailable.js';
import { imapMailboxReader } from '../../../../src/infrastructure/email/imap/imapMailboxReader.js';
import { DEALER_MAILBOX } from '../../../support/dealerMailbox.js';
import { loadFixture } from '../../../support/fixtures.js';
import { simulatedImapClient } from '../../../support/simulatedImapClient.js';

const ALERTS_FOLDER = { ...DEALER_MAILBOX, mailbox: 'Alertes' };

const THREE_ALERTS = [
  { uid: 41, receivedAt: '2026-10-11T19:02:11.000Z', source: 'alerte Leboncoin' },
  { uid: 42, receivedAt: '2026-10-12T06:12:44.000Z', source: 'alerte La Centrale' },
  { uid: 43, receivedAt: '2026-10-15T05:48:09.000Z', source: 'alerte ParuVendu' },
];

describe('lecture de la boîte mail en IMAP', () => {
  it('la boîte Gmail dédiée sur le port 993 : connexion chiffrée au nom de la concession, sans journal d’imapflow, dossier « Alertes » verrouillé, uidValidity et nombre d’emails lus à l’ouverture', async () => {
    // Given
    const imap = simulatedImapClient({ uidValidity: 7n, messages: THREE_ALERTS });

    // When
    const session = await imapMailboxReader(imap.createClient).open(ALERTS_FOLDER);

    // Then
    expect(imap.connections()).toEqual([
      {
        host: 'imap.gmail.com',
        port: 993,
        secure: true,
        auth: { user: 'concession.veille@example.com', pass: 'abcd efgh ijkl mnop' },
        logger: false,
      },
    ]);
    expect(imap.lockedMailboxes()).toEqual(['Alertes']);
    expect(session).toMatchObject({ uidValidity: 7, messageCount: 3 });
  });

  it('le test de la boîte d’un hébergeur sur le port 143, depuis l’écran Sites : connexion sans TLS d’emblée, attendue 15 secondes au plus', async () => {
    // Given
    const imap = simulatedImapClient({ uidValidity: 1n });
    const hostedMailbox = { ...DEALER_MAILBOX, host: 'mail.garage-des-graves.fr', port: 143 };

    // When
    await imapMailboxReader(imap.createClient).open(hostedMailbox, 15_000);

    // Then
    expect(imap.connections()).toEqual([
      expect.objectContaining({ host: 'mail.garage-des-graves.fr', port: 143, secure: false, connectionTimeout: 15_000 }),
    ]);
  });

  it('après le dernier email lu (UID 43), la recherche « 44:* » d’une boîte sans nouvel email rend le 43 : il n’est pas relu', async () => {
    // Given
    const imap = simulatedImapClient({ uidValidity: 7n, messages: THREE_ALERTS });
    const session = await imapMailboxReader(imap.createClient).open(ALERTS_FOLDER);

    // When
    const uids = await session.uidsAfter(43);

    // Then
    expect(imap.searches()).toEqual([{ uid: '44:*' }]);
    expect(uids).toEqual([]);
  });

  it('deux emails arrivés depuis le dernier lu (UID 41) : les UID 42 et 43 sont à lire, dans l’ordre', async () => {
    // Given
    const imap = simulatedImapClient({ uidValidity: 7n, messages: THREE_ALERTS });
    const session = await imapMailboxReader(imap.createClient).open(ALERTS_FOLDER);

    // When
    const uids = await session.uidsAfter(41);

    // Then
    expect(uids).toEqual([42, 43]);
  });

  it('première lecture : les emails reçus depuis le 12 octobre sont cherchés par date (SINCE), celui du matin du 12 compris', async () => {
    // Given
    const imap = simulatedImapClient({ uidValidity: 7n, messages: THREE_ALERTS });
    const session = await imapMailboxReader(imap.createClient).open(ALERTS_FOLDER);

    // When
    const uids = await session.uidsSince('2026-10-12T08:30:00.000Z');

    // Then
    expect(imap.searches()).toEqual([{ since: new Date('2026-10-12T08:30:00.000Z') }]);
    expect(uids).toEqual([42, 43]);
  });

  it('un email d’alerte est rendu tel que le serveur l’envoie, pour être décodé ensuite', async () => {
    // Given
    const source = loadFixture('emails/paruvendu/une-nouvelle-annonce.eml');
    const imap = simulatedImapClient({ uidValidity: 7n, messages: [{ uid: 44, receivedAt: '2026-10-15T06:05:12.000Z', source }] });
    const session = await imapMailboxReader(imap.createClient).open(ALERTS_FOLDER);

    // When
    const read = await session.read(44);

    // Then
    expect(Buffer.from(read ?? new Uint8Array()).toString('utf8')).toBe(source);
  });

  it('un email supprimé sur le téléphone entre la recherche et la lecture : il n’y a rien à lire', async () => {
    // Given
    const imap = simulatedImapClient({ uidValidity: 7n, messages: THREE_ALERTS });
    const session = await imapMailboxReader(imap.createClient).open(ALERTS_FOLDER);

    // When
    const read = await session.read(44);

    // Then
    expect(read).toBeUndefined();
  });

  it('la connexion coupée pendant la recherche : erreur de lecture avec le message d’imapflow, puis la fermeture rend le verrou sans lever, même si la déconnexion échoue', async () => {
    // Given
    const connectionLost = new Error('Connection not available');
    const imap = simulatedImapClient({
      uidValidity: 7n,
      messages: THREE_ALERTS,
      searchFailure: connectionLost,
      logoutFailure: connectionLost,
    });
    const session = await imapMailboxReader(imap.createClient).open(ALERTS_FOLDER);

    // When
    const search = session.uidsAfter(41);
    const searchFailure = await search.catch((error: unknown) => error);
    const closing = session.close();

    // Then
    expect(searchFailure).toEqual(new MailboxUnavailable('readFailed', 'Connection not available'));
    await expect(closing).resolves.toBeUndefined();
    expect(imap.steps()).toEqual(['connect', 'lock Alertes', 'release Alertes', 'logout']);
  });

  it('un nom de serveur mal saisi : l’ouverture échoue avec le message de Node, classé serveur injoignable, sans déconnexion à faire', async () => {
    // Given
    const imap = simulatedImapClient({ connectFailure: new Error('getaddrinfo ENOTFOUND imap.gmial.com') });

    // When
    const opening = imapMailboxReader(imap.createClient).open({ ...ALERTS_FOLDER, host: 'imap.gmial.com' });

    // Then
    await expect(opening).rejects.toEqual(new MailboxUnavailable('serverUnreachable', 'getaddrinfo ENOTFOUND imap.gmial.com'));
    expect(imap.steps()).toEqual(['connect']);
  });

  it('un dossier « Alertes » qui n’existe pas dans la boîte : l’ouverture échoue avec le message d’imapflow, et la connexion est fermée', async () => {
    // Given
    const imap = simulatedImapClient({ lockFailure: new Error('Command failed') });

    // When
    const opening = imapMailboxReader(imap.createClient).open(ALERTS_FOLDER);

    // Then
    await expect(opening).rejects.toEqual(new MailboxUnavailable('readFailed', 'Command failed'));
    expect(imap.steps()).toEqual(['connect', 'lock Alertes', 'logout']);
  });
});
