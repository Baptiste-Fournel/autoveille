import { describe, expect, it } from 'vitest';
import type {
  CheckNowResponse,
  CheckResultDto,
  MeResponse,
  OkResponse,
  OverviewResponse,
  PushKeyResponse,
  SiteDto,
  SourcesResponse,
} from '../../src/shared/api.js';
import { OWNER_PASSWORD, SETUP_CODE } from '../support/authentication.js';
import { alertEmail } from '../support/dealerInbox.js';
import { DEALER_MAILBOX } from '../support/dealerMailbox.js';
import {
  DEALER,
  notificationsReceived,
  openDealership,
  PHONE_SUBSCRIPTION,
  savedSettings,
  setUpDealership,
  throughCaddy,
} from '../support/dealerPhone.js';
import { loadFixture } from '../support/fixtures.js';
import { porscheGirondeAlert } from '../support/porscheGirondeAlert.js';

const LACENTRALE_ALERT_CONFIRMED = alertEmail({
  uid: 3,
  from: 'La Centrale <info@mail-alerte.lacentrale.fr>',
  subject: 'Création de votre alerte',
  receivedAt: '2026-10-15T08:12:40.000Z',
  messageId: '<creation-alerte-33000@mail-alerte.lacentrale.fr>',
  html: loadFixture('emails/lacentrale/confirmation-de-creation-d-alerte.html'),
});

const PARUVENDU_ALERT_CONFIRMED = alertEmail({
  uid: 4,
  from: 'ParuVendu <info@paruvendu.fr>',
  subject: 'ParuVendu.fr - Confirmation de la création de votre alerte',
  receivedAt: '2026-10-15T08:16:02.000Z',
  messageId: '<confirmation-alerte-8529668@paruvendu.fr>',
  html: loadFixture('emails/paruvendu/confirmation-de-creation-d-alerte.html'),
});

const AUTOSCOUT24_SEARCH_SAVED = alertEmail({
  uid: 5,
  from: 'AutoScout24 <savedsearches@notifications.autoscout24.com>',
  subject: 'Profil de recherche 15/10/2026 : ta recherche a bien été enregistrée',
  receivedAt: '2026-10-15T08:21:19.000Z',
  messageId: '<recherche-sauvegardee@notifications.autoscout24.com>',
  html: loadFixture('emails/autoscout24/confirmation-de-recherche-sauvegardee.html'),
});

const MAIN_SITES = ['autoscout24', 'lacentrale', 'leboncoin', 'paruvendu'];

const DEALERSHIP_ADDRESS = 'autoveille.demo-automobiles.fr';

const PASSWORD_FROM_THE_ENVIRONMENT = 'veille-concession-2026';

describe('mise en route, une seule fois', () => {
  it('le concessionnaire saisit le code sur son téléphone, choisit son mot de passe, se présente, branche la boîte Gmail des alertes, voit arriver les confirmations des sites et reçoit la notification d’essai', async () => {
    // Given
    const { application, inbox, pushService, phone } = await openDealership();
    const firstVisit = await phone.request<MeResponse>('GET', '/api/me');

    // When
    const setup = await phone.request<OkResponse>('POST', '/api/setup', { setupCode: SETUP_CODE, password: OWNER_PASSWORD });
    await savedSettings(phone, (settings) => ({ ...settings, dealer: DEALER }));
    const mailboxTest = await phone.request<CheckResultDto>('POST', '/api/sources/imap/test', DEALER_MAILBOX);
    await savedSettings(phone, (settings) => ({ ...settings, imap: DEALER_MAILBOX }));
    inbox.receive(LACENTRALE_ALERT_CONFIRMED, PARUVENDU_ALERT_CONFIRMED, AUTOSCOUT24_SEARCH_SAVED);
    const check = await phone.request<CheckNowResponse>('POST', '/api/sources/check-now');
    await savedSettings(phone, (settings) => ({ ...settings, alertsDone: { ...settings.alertsDone, leboncoin: true } }));
    const { body: pushKey } = await phone.request<PushKeyResponse>('GET', '/api/push/key');
    await phone.request('POST', '/api/push/subscribe', { subscription: PHONE_SUBSCRIPTION });
    const pushTest = await phone.request<CheckResultDto>('POST', '/api/push/test');

    // Then
    const { body: overview } = await phone.request<OverviewResponse>('GET', '/api/overview');
    const { body: sources } = await phone.request<SourcesResponse>('GET', '/api/sources');
    const site = (key: string): SiteDto | undefined => sources.sites.find((candidate) => candidate.key === key);
    expect(firstVisit.body).toEqual({ authenticated: false, needsSetup: true, setupCodeRequired: true });
    expect(setup).toEqual({ status: 200, body: { ok: true } });
    expect(mailboxTest.body).toEqual({ ok: true, detail: 'Connexion réussie, 0 email(s) dans la boîte.' });
    expect(check.body.mail).toEqual({
      source: 'email',
      ok: true,
      detail: '3 email(s) lu(s), 0 annonce(s), 0 nouvelle(s) correspondant aux réglages',
    });
    expect(overview.dealer).toEqual(DEALER);
    expect(overview.imapConfigured).toBe(true);
    expect([...overview.alertsDone].sort()).toEqual(MAIN_SITES);
    expect(overview.pushKey).toBe(pushKey.key);
    expect(site('lacentrale')?.alert).toMatchObject({
      maxKm: 100000,
      postalCode: '33000',
      sellerType: 'particulier',
      manageUrl: 'https://www.lacentrale.fr/compte/notification/recherche',
    });
    expect(site('paruvendu')?.alert?.criteria).toBe("Voiture d'occasion, Bordeaux (33000), Rayon de 100 km, Jusqu'à 100 000 km");
    expect(site('autoscout24')?.alert?.manageUrl).toBe('https://www.autoscout24.fr/account/searches');
    expect(sources.imap).toMatchObject({ user: DEALER_MAILBOX.user, hasPassword: true, configured: true });
    expect(pushTest.body).toEqual({ ok: true, detail: 'Notification envoyée à 1 appareil(s).' });
    expect(notificationsReceived(pushService)).toEqual([
      { title: 'AutoVeille', body: 'Les notifications fonctionnent sur cet appareil.', url: 'http://localhost:80/' },
    ]);
    expect(application.ports.subscriptions.all().map((subscription) => subscription.endpoint)).toEqual([PHONE_SUBSCRIPTION.endpoint]);
  });

  it('sans BASE_URL, les liens des notifications mènent à l’adresse HTTPS par laquelle le concessionnaire a ouvert l’application la première fois, derrière Caddy', async () => {
    // Given
    const { inbox, pushService, phone } = await setUpDealership({ connection: throughCaddy(DEALERSHIP_ADDRESS) });
    inbox.receive(porscheGirondeAlert({ uid: 7, receivedAt: '2026-10-15T08:24:51.000Z' }));

    // When
    await phone.request('POST', '/api/sources/check-now');

    // Then
    expect(notificationsReceived(pushService).map((notification) => notification.url)).toEqual([
      `https://${DEALERSHIP_ADDRESS}/#/annonce/1`,
    ]);
  });

  it('avec APP_PASSWORD dans la configuration du serveur, le téléphone n’a pas de première connexion à faire : ce mot de passe ouvre directement l’application', async () => {
    // Given
    const { phone } = await openDealership({ environment: { APP_PASSWORD: PASSWORD_FROM_THE_ENVIRONMENT } });
    const firstVisit = await phone.request<MeResponse>('GET', '/api/me');

    // When
    const login = await phone.request<OkResponse>('POST', '/api/login', { password: PASSWORD_FROM_THE_ENVIRONMENT });

    // Then
    const overview = await phone.request<OverviewResponse>('GET', '/api/overview');
    expect(firstVisit.body).toEqual({ authenticated: false, needsSetup: false, setupCodeRequired: false });
    expect(login).toEqual({ status: 200, body: { ok: true } });
    expect(overview.status).toBe(200);
  });
});
