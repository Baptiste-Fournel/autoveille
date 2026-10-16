import { describe, expect, it } from 'vitest';
import { MailboxUnavailable } from '../../../src/application/ports/mailboxUnavailable.js';
import { testMailbox } from '../../../src/application/sources/testMailbox.js';
import { fakeMailboxReader, type StoredEmail } from '../../fakes/fakeMailboxReader.js';
import { fakeSettingsRepository } from '../../fakes/fakeSettingsRepository.js';
import { DEALER_MAILBOX, settingsWithDealerMailbox } from '../../support/dealerMailbox.js';

const threeAlerts: readonly StoredEmail[] = [
  { uid: 41, receivedAt: '2026-10-13T07:02:11.000Z', source: 'alerte Leboncoin' },
  { uid: 42, receivedAt: '2026-10-14T06:12:44.000Z', source: 'alerte La Centrale' },
  { uid: 43, receivedAt: '2026-10-15T05:48:09.000Z', source: 'alerte ParuVendu' },
];

describe('tester la boîte mail depuis l’écran Sites', () => {
  it('sans adresse ni mot de passe d’application, ni saisis ni enregistrés, le test le dit sans se connecter', async () => {
    // Given
    const settings = fakeSettingsRepository();
    const mailboxReader = fakeMailboxReader({ emails: threeAlerts });

    // When
    const result = await testMailbox({ settings, mailboxReader }, {});

    // Then
    expect(result).toEqual({ ok: false, detail: 'Adresse ou mot de passe d’application manquant.' });
    expect(mailboxReader.openings()).toEqual([]);
  });

  it('la boîte Gmail dédiée répond : le test compte ses emails, avec un délai de connexion de 15 secondes', async () => {
    // Given
    const settings = fakeSettingsRepository();
    const mailboxReader = fakeMailboxReader({ emails: threeAlerts });

    // When
    const result = await testMailbox({ settings, mailboxReader }, DEALER_MAILBOX);

    // Then
    expect(result).toEqual({ ok: true, detail: 'Connexion réussie, 3 email(s) dans la boîte.' });
    expect(mailboxReader.openings()).toEqual([{ account: DEALER_MAILBOX, connectionTimeoutMs: 15_000 }]);
    expect(mailboxReader.openSessions()).toBe(0);
  });

  it('les champs laissés vides par le formulaire, mot de passe compris, prennent la boîte enregistrée', async () => {
    // Given
    const settings = fakeSettingsRepository(settingsWithDealerMailbox());
    const mailboxReader = fakeMailboxReader({ emails: threeAlerts });

    // When
    const result = await testMailbox({ settings, mailboxReader }, { host: '', user: '', pass: '', mailbox: 'Alertes' });

    // Then
    expect(result.ok).toBe(true);
    expect(mailboxReader.openings()[0]?.account).toEqual({ ...DEALER_MAILBOX, mailbox: 'Alertes' });
  });

  it('Gmail refuse le mot de passe habituel : le message parle du mot de passe d’application', async () => {
    // Given
    const settings = fakeSettingsRepository();
    const refusal = new MailboxUnavailable('authenticationRefused', 'Invalid credentials (Failure)');
    const mailboxReader = fakeMailboxReader({ refusal });

    // When
    const result = await testMailbox({ settings, mailboxReader }, { ...DEALER_MAILBOX, pass: 'motdepasse-habituel' });

    // Then
    expect(result).toEqual({
      ok: false,
      detail:
        'Connexion à la boîte mail refusée : vérifiez l’adresse et le mot de passe d’application (Gmail exige un mot de passe d’application, pas le mot de passe habituel).',
    });
  });

  it('un serveur mail qui refuse la connexion : le message reprend celui du serveur', async () => {
    // Given
    const settings = fakeSettingsRepository();
    const refusal = new MailboxUnavailable('serverUnreachable', 'connect ECONNREFUSED 127.0.0.1:1');
    const mailboxReader = fakeMailboxReader({ refusal });

    // When
    const result = await testMailbox({ settings, mailboxReader }, { ...DEALER_MAILBOX, host: '127.0.0.1', port: 1 });

    // Then
    expect(result).toEqual({ ok: false, detail: 'Serveur mail injoignable (connect ECONNREFUSED 127.0.0.1:1).' });
  });

  it('un dossier de boîte qui n’existe pas : le message reprend l’erreur de lecture du serveur', async () => {
    // Given
    const settings = fakeSettingsRepository();
    const refusal = new MailboxUnavailable('readFailed', 'Unknown Mailbox: Alertes (Failure)');
    const mailboxReader = fakeMailboxReader({ refusal });

    // When
    const result = await testMailbox({ settings, mailboxReader }, { ...DEALER_MAILBOX, mailbox: 'Alertes' });

    // Then
    expect(result).toEqual({ ok: false, detail: 'Erreur de lecture de la boîte mail : Unknown Mailbox: Alertes (Failure)' });
  });
});
