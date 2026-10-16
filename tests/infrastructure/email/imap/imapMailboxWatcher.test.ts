import { describe, expect, it } from 'vitest';
import { mailboxPolling } from '../../../../src/application/sources/pollMailbox.js';
import { defaultSettings } from '../../../../src/domain/settings/defaults.js';
import type { Settings } from '../../../../src/domain/settings/types.js';
import { imapMailboxWatcher, type MailboxWatch } from '../../../../src/infrastructure/email/imap/imapMailboxWatcher.js';
import { type FakeLogger, fakeLogger } from '../../../fakes/fakeLogger.js';
import { type FakeSettingsRepository, fakeSettingsRepository } from '../../../fakes/fakeSettingsRepository.js';
import { DEALER_MAILBOX, settingsWithDealerMailbox } from '../../../support/dealerMailbox.js';
import { gmailRefusesPassword, gmailUnknownMailbox } from '../../../support/imapflowErrors.js';
import { mailWorld } from '../../../support/mailWorld.js';
import { type ManualTimers, manualTimers } from '../../../support/manualTimers.js';
import { type SimulatedImapClient, type StoredImapMessage, simulatedImapClient } from '../../../support/simulatedImapClient.js';

const MINUTE_MS = 60_000;

const IMAPFLOW_IDLE_DELAY_MS = 15_000;

const NEW_PASSWORD = 'qrst uvwx yzab cdef';

const GMAIL_UNREACHABLE = new Error('getaddrinfo EAI_AGAIN imap.gmail.com');

const LEBONCOIN_ALERT: StoredImapMessage = { uid: 44, receivedAt: '2026-10-15T08:31:02.000Z', source: 'alerte Leboncoin' };

const LA_CENTRALE_ALERT: StoredImapMessage = { uid: 45, receivedAt: '2026-10-15T08:31:09.000Z', source: 'alerte La Centrale' };

const PARUVENDU_ALERT: StoredImapMessage = { uid: 46, receivedAt: '2026-10-15T08:31:15.000Z', source: 'alerte ParuVendu' };

interface WatchedMailbox {
  readonly watch: MailboxWatch;
  readonly imap: SimulatedImapClient;
  readonly timers: ManualTimers;
  readonly settings: FakeSettingsRepository;
  readonly logger: FakeLogger;
  readonly reads: () => number;
}

interface WatchedMailboxOptions {
  readonly imap?: SimulatedImapClient;
  readonly settings?: Settings;
  readonly readMailbox?: () => void;
}

const watchedMailbox = (options: WatchedMailboxOptions = {}): WatchedMailbox => {
  const imap = options.imap ?? simulatedImapClient({ uidValidity: 7n });
  const timers = manualTimers();
  const settings = fakeSettingsRepository(options.settings ?? settingsWithDealerMailbox());
  const logger = fakeLogger();
  let reads = 0;
  const watch = imapMailboxWatcher({
    createClient: imap.createClient,
    timers,
    settings,
    readMailbox:
      options.readMailbox ??
      (() => {
        reads += 1;
      }),
    logger,
  });
  return { watch, imap, timers, settings, logger, reads: () => reads };
};

const settled = (timers: ManualTimers): Promise<void> => timers.elapse(0);

const waitsBetweenAttempts = async (
  imap: SimulatedImapClient,
  timers: ManualTimers,
  attempts: number,
  afterEachAttempt: () => void = () => undefined,
): Promise<readonly number[]> => {
  let waits: readonly number[] = [];
  let waited = 0;
  let seen = imap.connections().length;
  while (waits.length < attempts) {
    await timers.elapse(1_000);
    waited += 1_000;
    if (imap.connections().length > seen) {
      seen = imap.connections().length;
      waits = [...waits, waited];
      waited = 0;
      afterEachAttempt();
    }
  }
  return waits;
};

describe('surveillance de la boîte mail en IMAP IDLE', () => {
  it('la boîte Gmail configurée : une connexion reste ouverte sur INBOX en attente des nouveaux emails, et la boîte est lue une fois à la connexion', async () => {
    // Given
    const { watch, imap, timers, logger, reads } = watchedMailbox();

    // When
    watch.start();
    await settled(timers);

    // Then
    expect(imap.openConnections()).toEqual([
      {
        host: 'imap.gmail.com',
        port: 993,
        secure: true,
        auth: { user: 'concession.veille@example.com', pass: 'abcd efgh ijkl mnop' },
        logger: false,
      },
    ]);
    expect(imap.lockedMailboxes()).toEqual(['INBOX']);
    expect(reads()).toBe(1);
    expect(logger.messages()).toEqual(['IMAP IDLE : à l’écoute de « INBOX »']);
  });

  it('une alerte Leboncoin arrive dans la boîte : Gmail la signale et la boîte est lue une fois', async () => {
    // Given
    const { watch, imap, timers, reads } = watchedMailbox();
    watch.start();
    await settled(timers);
    const readsAtConnection = reads();

    // When
    imap.receive(LEBONCOIN_ALERT);
    await settled(timers);

    // Then
    expect(reads() - readsAtConnection).toBe(1);
  });

  it('deux alertes arrivent pendant la lecture déclenchée par une première : une seule lecture de plus, après celle en cours', async () => {
    // Given
    const world = mailWorld([]);
    const polling = mailboxPolling(world);
    const { watch, imap, timers } = watchedMailbox({ readMailbox: () => void polling.pollForNewEmail() });
    watch.start();
    await settled(timers);
    const openingsAtConnection = world.mailboxReader.openings().length;

    // When
    imap.receive(LEBONCOIN_ALERT);
    imap.receive(LA_CENTRALE_ALERT);
    imap.receive(PARUVENDU_ALERT);
    await settled(timers);

    // Then
    expect(world.mailboxReader.openings().length - openingsAtConnection).toBe(2);
  });

  it('Gmail coupe la connexion IDLE (« Socket timeout ») : la raison est journalisée, une nouvelle connexion part 5 s plus tard, et la boîte est relue pour les emails arrivés entre-temps', async () => {
    // Given
    const { watch, imap, timers, logger, reads } = watchedMailbox();
    watch.start();
    await settled(timers);

    // When
    imap.cutConnections(new Error('Socket timeout'));
    await timers.elapse(4_999);
    const connectionsBeforeFiveSeconds = imap.connections().length;
    await timers.elapse(1);

    // Then
    expect(connectionsBeforeFiveSeconds).toBe(1);
    expect(imap.connections()).toHaveLength(2);
    expect(imap.openConnections()).toHaveLength(1);
    expect(reads()).toBe(2);
    expect(logger.messages()).toContain('IMAP IDLE interrompu (Socket timeout), nouvel essai dans 5 s');
  });

  it('Gmail injoignable pendant une panne de la nuit : nouveaux essais au bout de 5 s, 10 s, 20 s, 40 s, 80 s et 160 s, puis toutes les 5 minutes', async () => {
    // Given
    const imap = simulatedImapClient({ uidValidity: 7n });
    imap.refuseConnections(GMAIL_UNREACHABLE);
    const { watch, timers, logger } = watchedMailbox({ imap });

    // When
    watch.start();
    await settled(timers);
    const waits = await waitsBetweenAttempts(imap, timers, 8);

    // Then
    expect(waits).toEqual([5_000, 10_000, 20_000, 40_000, 80_000, 160_000, 300_000, 300_000]);
    expect(logger.messages().slice(0, 2)).toEqual([
      'IMAP IDLE interrompu (getaddrinfo EAI_AGAIN imap.gmail.com), nouvel essai dans 5 s',
      'IMAP IDLE interrompu (getaddrinfo EAI_AGAIN imap.gmail.com), nouvel essai dans 10 s',
    ]);
  });

  it('après la panne, une connexion restée ouverte une minute ramène l’attente à 5 s : la coupure suivante est rattrapée en 5 s, pas en 80 s', async () => {
    // Given
    const imap = simulatedImapClient({ uidValidity: 7n });
    imap.refuseConnections(GMAIL_UNREACHABLE);
    const { watch, timers, logger } = watchedMailbox({ imap });
    watch.start();
    await settled(timers);
    await waitsBetweenAttempts(imap, timers, 3);
    imap.acceptConnections();
    await waitsBetweenAttempts(imap, timers, 1);
    await timers.elapse(MINUTE_MS);

    // When
    imap.cutConnections();
    const waits = await waitsBetweenAttempts(imap, timers, 1);

    // Then
    expect(waits).toEqual([5_000]);
    expect(imap.openConnections()).toHaveLength(1);
    expect(logger.messages()).toContain('IMAP IDLE interrompu (connexion fermée), nouvel essai dans 5 s');
  });

  it('un équipement du réseau coupe chaque connexion au début de l’IDLE, 15 s après l’ouverture de INBOX : les nouveaux essais s’espacent de 5 s jusqu’à 5 minutes, au lieu de reprendre toutes les 5 s', async () => {
    // Given
    const { watch, imap, timers, logger, reads } = watchedMailbox();
    const cutWhenIdleStarts = (): void => {
      timers.setTimeout(() => imap.cutConnections(), IMAPFLOW_IDLE_DELAY_MS);
    };
    watch.start();
    await settled(timers);

    // When
    cutWhenIdleStarts();
    const waits = await waitsBetweenAttempts(imap, timers, 8, cutWhenIdleStarts);

    // Then
    expect(waits).toEqual([20_000, 25_000, 35_000, 55_000, 95_000, 175_000, 315_000, 315_000]);
    expect(reads()).toBe(9);
    expect(logger.messages().slice(0, 4)).toEqual([
      'IMAP IDLE : à l’écoute de « INBOX »',
      'IMAP IDLE interrompu (connexion fermée), nouvel essai dans 5 s',
      'IMAP IDLE : à l’écoute de « INBOX »',
      'IMAP IDLE interrompu (connexion fermée), nouvel essai dans 10 s',
    ]);
  });

  it('un dossier « Alertes » qui n’existe pas dans la boîte : la connexion est fermée, la réponse de Gmail journalisée, et un nouvel essai suit', async () => {
    // Given
    const imap = simulatedImapClient({ lockFailure: gmailUnknownMailbox('Alertes') });
    const { watch, timers, logger, reads } = watchedMailbox({
      imap,
      settings: settingsWithDealerMailbox({ imap: { ...DEALER_MAILBOX, mailbox: 'Alertes' } }),
    });

    // When
    watch.start();
    await settled(timers);

    // Then
    expect(imap.steps()).toEqual(['connect', 'lock Alertes', 'logout']);
    expect(imap.openConnections()).toEqual([]);
    expect(reads()).toBe(0);
    expect(logger.messages()).toEqual([
      'IMAP IDLE interrompu ([NONEXISTENT] Unknown Mailbox: Alertes (now in authenticated state) (Failure)), nouvel essai dans 5 s',
    ]);
  });

  it('Gmail refuse le mot de passe d’application : le journal dit pourquoi et quand a lieu le nouvel essai, sans jamais écrire le mot de passe', async () => {
    // Given
    const imap = simulatedImapClient({ uidValidity: 7n });
    imap.refuseConnections(gmailRefusesPassword());
    const { watch, timers, logger } = watchedMailbox({ imap });

    // When
    watch.start();
    await settled(timers);
    await waitsBetweenAttempts(imap, timers, 2);

    // Then
    expect(logger.messages()).toEqual([
      'IMAP IDLE interrompu ([AUTHENTICATIONFAILED] Invalid credentials (Failure)), nouvel essai dans 5 s',
      'IMAP IDLE interrompu ([AUTHENTICATIONFAILED] Invalid credentials (Failure)), nouvel essai dans 10 s',
      'IMAP IDLE interrompu ([AUTHENTICATIONFAILED] Invalid credentials (Failure)), nouvel essai dans 20 s',
    ]);
    expect(logger.messages().filter((message) => message.includes(DEALER_MAILBOX.pass))).toEqual([]);
  });
});

describe('la surveillance suit la boîte enregistrée dans Sites', () => {
  it('sans adresse ni mot de passe d’application : aucune connexion IDLE ; la boîte configurée ensuite dans Sites est surveillée aussitôt', async () => {
    // Given
    const { watch, imap, timers, settings } = watchedMailbox({ settings: defaultSettings() });
    watch.start();
    await settled(timers);
    const connectionsWithoutMailbox = imap.connections().length;

    // When
    settings.save(settingsWithDealerMailbox());
    watch.settingsSaved();
    await settled(timers);

    // Then
    expect(connectionsWithoutMailbox).toBe(0);
    expect(imap.openConnections()).toHaveLength(1);
  });

  it('le mot de passe d’application changé dans Sites : la connexion IDLE se refait avec le nouveau, et l’ancienne fermée n’en appelle pas une autre', async () => {
    // Given
    const { watch, imap, timers, settings } = watchedMailbox();
    watch.start();
    await settled(timers);

    // When
    settings.save(settingsWithDealerMailbox({ imap: { ...DEALER_MAILBOX, pass: NEW_PASSWORD } }));
    watch.settingsSaved();
    await settled(timers);
    await timers.elapse(10 * MINUTE_MS);

    // Then
    expect(imap.connections().map((options) => options.auth?.pass)).toEqual([DEALER_MAILBOX.pass, NEW_PASSWORD]);
    expect(imap.openConnections().map((options) => options.auth?.pass)).toEqual([NEW_PASSWORD]);
  });

  it('le dossier passé de INBOX au libellé « Alertes » dans Sites : la connexion IDLE surveille désormais « Alertes »', async () => {
    // Given
    const { watch, imap, timers, settings } = watchedMailbox();
    watch.start();
    await settled(timers);

    // When
    settings.save(settingsWithDealerMailbox({ imap: { ...DEALER_MAILBOX, mailbox: 'Alertes' } }));
    watch.settingsSaved();
    await settled(timers);

    // Then
    expect(imap.lockedMailboxes()).toEqual(['INBOX', 'Alertes']);
    expect(imap.openConnections()).toHaveLength(1);
  });

  it('les réglages enregistrés sans toucher à la boîte (kilométrage maximal passé à 120 000 km) : la connexion IDLE du démarrage reste ouverte', async () => {
    // Given
    const { watch, imap, timers, settings } = watchedMailbox();
    watch.start();
    await settled(timers);

    // When
    settings.save(settingsWithDealerMailbox({ maxKm: 120_000 }));
    watch.settingsSaved();
    await settled(timers);

    // Then
    expect(imap.connections()).toHaveLength(1);
    expect(imap.openConnections()).toHaveLength(1);
  });

  it('le bon mot de passe enregistré dans Sites pendant l’attente qui suit un refus : nouvelle connexion aussitôt, sans attendre la fin de l’attente', async () => {
    // Given
    const imap = simulatedImapClient({ uidValidity: 7n });
    imap.refuseConnections(gmailRefusesPassword());
    const { watch, timers, settings } = watchedMailbox({ imap });
    watch.start();
    await settled(timers);
    await waitsBetweenAttempts(imap, timers, 4);
    imap.acceptConnections();

    // When
    settings.save(settingsWithDealerMailbox({ imap: { ...DEALER_MAILBOX, pass: NEW_PASSWORD } }));
    watch.settingsSaved();
    await settled(timers);
    const connectionsRightAfterSaving = imap.connections().length;
    await timers.elapse(10 * MINUTE_MS);

    // Then
    expect(connectionsRightAfterSaving).toBe(6);
    expect(imap.connections()).toHaveLength(6);
    expect(imap.openConnections().map((options) => options.auth?.pass)).toEqual([NEW_PASSWORD]);
  });

  it('IMAP_IDLE=0, la surveillance n’est jamais lancée : la boîte enregistrée ensuite dans Sites n’ouvre aucune connexion IDLE', async () => {
    // Given
    const { watch, imap, timers, settings } = watchedMailbox({ settings: defaultSettings() });

    // When
    settings.save(settingsWithDealerMailbox());
    watch.settingsSaved();
    await settled(timers);

    // Then
    expect(imap.connections()).toEqual([]);
  });
});

describe('arrêt du serveur', () => {
  it('l’arrêt du serveur ferme la connexion IDLE, et plus aucune reconnexion ne suit', async () => {
    // Given
    const { watch, imap, timers } = watchedMailbox();
    watch.start();
    await settled(timers);

    // When
    await watch.stop();
    await timers.elapse(60 * MINUTE_MS);

    // Then
    expect(imap.steps().at(-1)).toBe('logout');
    expect(imap.openConnections()).toEqual([]);
    expect(imap.connections()).toHaveLength(1);
  });

  it('l’arrêt du serveur pendant l’attente qui suit une panne de Gmail : plus aucun essai de connexion', async () => {
    // Given
    const imap = simulatedImapClient({ uidValidity: 7n });
    imap.refuseConnections(GMAIL_UNREACHABLE);
    const { watch, timers } = watchedMailbox({ imap });
    watch.start();
    await settled(timers);
    imap.acceptConnections();

    // When
    await watch.stop();
    await timers.elapse(60 * MINUTE_MS);

    // Then
    expect(imap.connections()).toHaveLength(1);
  });

  it('l’arrêt du serveur pendant que Gmail ouvre encore INBOX : la boîte ouverte après coup ne déclenche ni lecture ni écoute', async () => {
    // Given
    let answerSelection = (): void => undefined;
    const selectionAnswered = new Promise<void>((resolve) => {
      answerSelection = resolve;
    });
    const { watch, timers, logger, reads } = watchedMailbox({ imap: simulatedImapClient({ uidValidity: 7n, selectionAnswered }) });
    watch.start();
    await settled(timers);

    // When
    await watch.stop();
    answerSelection();
    await settled(timers);

    // Then
    expect(reads()).toBe(0);
    expect(logger.messages()).toEqual([]);
  });

  it('Gmail signale une alerte pendant la déconnexion qui suit l’arrêt du serveur : aucune lecture n’est lancée', async () => {
    // Given
    let answerLogout = (): void => undefined;
    const logoutAnswered = new Promise<void>((resolve) => {
      answerLogout = resolve;
    });
    const imap = simulatedImapClient({ uidValidity: 7n, logoutAnswered });
    const { watch, timers, reads } = watchedMailbox({ imap });
    watch.start();
    await settled(timers);
    const readsAtConnection = reads();

    // When
    const stopping = watch.stop();
    imap.receive(LEBONCOIN_ALERT);
    answerLogout();
    await stopping;

    // Then
    expect(reads()).toBe(readsAtConnection);
  });

  it('l’arrêt du serveur pendant que la connexion IDLE s’établit : elle est fermée, sans lecture ni nouvel essai', async () => {
    // Given
    const { watch, imap, timers, reads } = watchedMailbox();
    watch.start();

    // When
    await watch.stop();
    await timers.elapse(60 * MINUTE_MS);

    // Then
    expect(imap.openConnections()).toEqual([]);
    expect(imap.connections()).toHaveLength(1);
    expect(reads()).toBe(0);
  });
});
