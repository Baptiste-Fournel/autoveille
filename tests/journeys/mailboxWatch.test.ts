import { describe, expect, it, vi } from 'vitest';
import { composedApplication } from '../support/composedApplication.js';
import { DEALER_MAILBOX, settingsWithDealerMailbox } from '../support/dealerMailbox.js';
import { loadFixture } from '../support/fixtures.js';
import type { ManualTimers } from '../support/manualTimers.js';
import { porscheGirondeAlert } from '../support/porscheGirondeAlert.js';
import { signedInApplication } from '../support/signedInApplication.js';
import { type StoredImapMessage, simulatedImapClient } from '../support/simulatedImapClient.js';

const MINUTE_MS = 60_000;

const NEW_PASSWORD = 'qrst uvwx yzab cdef';

const MOST_TURNS_OF_PENDING_WORK = 50;

const workDone = async (timers: ManualTimers, done: () => boolean, turns = MOST_TURNS_OF_PENDING_WORK): Promise<void> => {
  if (!done() && turns > 0) {
    await timers.elapse(0);
    await workDone(timers, done, turns - 1);
  }
};

const PARUVENDU_NEW_LISTING_ALERT: StoredImapMessage = {
  uid: 12,
  receivedAt: '2026-10-15T08:31:02.000Z',
  source: loadFixture('emails/paruvendu/une-nouvelle-annonce.eml'),
};

const LEBONCOIN_ALERT_RECEIVED_WHILE_STOPPED = porscheGirondeAlert({ uid: 7, receivedAt: '2026-10-15T06:48:13.000Z' });

describe('boîte mail surveillée en IMAP IDLE', () => {
  it('IMAP_IDLE=1 : l’alerte ParuVendu qui arrive dans la boîte est lue dans la foulée, sans attendre la relecture planifiée', async () => {
    // Given
    const imap = simulatedImapClient({ uidValidity: 7n });
    const { application, session } = await signedInApplication({ environment: { IMAP_IDLE: '1' }, imapClient: imap.createClient });
    await application.server.inject({ method: 'PUT', url: '/api/settings', headers: session, payload: { imap: DEALER_MAILBOX } });
    await application.start();
    await application.timers.elapse(0);

    // When
    imap.receive(PARUVENDU_NEW_LISTING_ALERT);
    await workDone(application.timers, () => application.ports.vehicles.allVehicles().length > 0);

    // Then
    expect(application.ports.vehicles.allVehicles()).toHaveLength(1);
    expect(application.ports.mailboxState.recentlyProcessed(10).map((email) => email.messageId)).toEqual([
      '<alerte-une-nouvelle-annonce@paruvendu.fr>',
    ]);
  });

  it('IMAP_IDLE=1 : l’alerte ParuVendu signalée par Gmail pendant la lecture, au démarrage, de l’alerte Leboncoin reçue pendant l’arrêt du serveur est lue juste après, sans attendre la relecture de filet', async () => {
    // Given
    let answerFetch = (): void => undefined;
    const fetchAnswered = new Promise<void>((resolve) => {
      answerFetch = resolve;
    });
    const imap = simulatedImapClient({ uidValidity: 7n, messages: [LEBONCOIN_ALERT_RECEIVED_WHILE_STOPPED], fetchAnswered });
    const application = await composedApplication({ environment: { IMAP_IDLE: '1' }, imapClient: imap.createClient });
    application.ports.settings.save(settingsWithDealerMailbox());
    await application.start();
    await workDone(application.timers, () => imap.searches().length > 0);

    // When
    imap.receive(PARUVENDU_NEW_LISTING_ALERT);
    answerFetch();
    await workDone(application.timers, () => application.ports.mailboxState.recentlyProcessed(10).length > 1);

    // Then
    expect(
      application.ports.mailboxState
        .recentlyProcessed(10)
        .map((email) => email.messageId)
        .sort(),
    ).toEqual(['<alerte-porsche-gironde-7@leboncoin.fr>', '<alerte-une-nouvelle-annonce@paruvendu.fr>']);
    expect(imap.connections()).toHaveLength(3);
  });

  it('IMAP_IDLE=1 : le disque du serveur plein fait échouer la lecture de l’alerte signalée par Gmail : le journal dit que c’est la lecture déclenchée par IMAP IDLE qui a échoué, pas une lecture planifiée', async () => {
    // Given
    const imap = simulatedImapClient({ uidValidity: 7n });
    const application = await composedApplication({ environment: { IMAP_IDLE: '1' }, imapClient: imap.createClient });
    application.ports.settings.save(settingsWithDealerMailbox());
    await application.start();
    await workDone(application.timers, () => application.ports.sourceRuns.all().length > 0);
    vi.spyOn(application.ports.sourceRuns, 'record').mockImplementation(() => {
      throw new Error('database or disk is full');
    });
    const journal = vi.spyOn(application.server.log, 'error');

    // When
    imap.receive(PARUVENDU_NEW_LISTING_ALERT);
    await workDone(application.timers, () => journal.mock.calls.length > 0);

    // Then
    expect(journal.mock.calls).toEqual([['lecture déclenchée par IMAP IDLE en échec : database or disk is full']]);
  });

  it('IMAP_IDLE=1 avec IMAP_POLL_MINUTES=2 : une connexion IDLE reste ouverte, et la boîte n’est relue en filet que toutes les dix minutes', async () => {
    // Given
    const imap = simulatedImapClient({ uidValidity: 7n });
    const { application, session } = await signedInApplication({
      environment: { IMAP_IDLE: '1', IMAP_POLL_MINUTES: '2' },
      imapClient: imap.createClient,
    });
    await application.server.inject({ method: 'PUT', url: '/api/settings', headers: session, payload: { imap: DEALER_MAILBOX } });

    // When
    await application.start();
    await application.timers.elapse(0);
    const atStart = imap.connections().length;
    await application.timers.elapse(5_000);
    const afterFirstPass = imap.connections().length;
    await application.timers.elapse(2 * MINUTE_MS);
    const afterTwoMinutes = imap.connections().length;
    await application.timers.elapse(8 * MINUTE_MS);

    // Then
    expect([atStart, afterFirstPass, afterTwoMinutes, imap.connections().length]).toEqual([2, 3, 3, 4]);
    expect(imap.openConnections()).toHaveLength(1);
  });

  it('IMAP_IDLE=0 : aucune connexion IDLE, la boîte est relue toutes les deux minutes comme avant', async () => {
    // Given
    const imap = simulatedImapClient({ uidValidity: 7n });
    const { application, session } = await signedInApplication({ environment: { IMAP_IDLE: '0' }, imapClient: imap.createClient });
    await application.server.inject({ method: 'PUT', url: '/api/settings', headers: session, payload: { imap: DEALER_MAILBOX } });

    // When
    await application.start();
    await application.timers.elapse(5_000);
    const afterFirstPass = imap.connections().length;
    await application.timers.elapse(2 * MINUTE_MS);

    // Then
    expect(afterFirstPass).toBe(1);
    expect(imap.connections()).toHaveLength(2);
    expect(imap.openConnections()).toEqual([]);
  });

  it('IMAP_IDLE=1 : le mot de passe d’application changé dans Sites, la connexion IDLE se refait avec le nouveau', async () => {
    // Given
    const imap = simulatedImapClient({ uidValidity: 7n });
    const { application, session } = await signedInApplication({ environment: { IMAP_IDLE: '1' }, imapClient: imap.createClient });
    await application.server.inject({ method: 'PUT', url: '/api/settings', headers: session, payload: { imap: DEALER_MAILBOX } });
    await application.start();
    await application.timers.elapse(0);

    // When
    await application.server.inject({
      method: 'PUT',
      url: '/api/settings',
      headers: session,
      payload: { imap: { ...DEALER_MAILBOX, pass: NEW_PASSWORD } },
    });
    await application.timers.elapse(0);

    // Then
    expect(imap.openConnections().map((options) => options.auth?.pass)).toEqual([NEW_PASSWORD]);
  });

  it('IMAP_IDLE=1 : à l’arrêt du serveur, la connexion IDLE est fermée', async () => {
    // Given
    const imap = simulatedImapClient({ uidValidity: 7n });
    const application = await composedApplication({ environment: { IMAP_IDLE: '1' }, imapClient: imap.createClient });
    application.ports.settings.save(settingsWithDealerMailbox());
    await application.start();
    await application.timers.elapse(0);
    const openWhileRunning = imap.openConnections().length;

    // When
    await application.stop();

    // Then
    expect(openWhileRunning).toBe(1);
    expect(imap.openConnections()).toEqual([]);
  });
});
