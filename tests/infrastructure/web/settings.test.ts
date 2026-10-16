import { describe, expect, it } from 'vitest';
import { DEALER_MAILBOX } from '../../support/dealerMailbox.js';
import { signedInApplication } from '../../support/signedInApplication.js';
import { GARAGE_BOT_TOKEN, GARAGE_CHAT_ID } from '../../support/telegramSettings.js';

const MASKED = '••••••••';

const LEPARKING_PORSCHE_911 = 'https://www.leparking.fr/voiture-occasion/porsche-911.html';

describe('écran Réglages', () => {
  it('les réglages arrivent avec le mot de passe de la boîte masqué, les variables des messages et les quatre familles suivies', async () => {
    // Given
    const { application, session } = await signedInApplication();
    await application.server.inject({ method: 'PUT', url: '/api/settings', headers: session, payload: { imap: DEALER_MAILBOX } });

    // When
    const response = await application.server.inject({ method: 'GET', url: '/api/settings', headers: session });

    // Then
    const body = response.json();
    expect(response.statusCode).toBe(200);
    expect(body.settings.imap).toEqual({ ...DEALER_MAILBOX, pass: MASKED });
    expect(body.families).toEqual([
      { key: 'allemandes', label: 'Allemandes' },
      { key: 'italiennes', label: 'Italiennes' },
      { key: 'americaines', label: 'Américaines' },
      { key: 'francaises', label: 'Françaises' },
    ]);
    expect(Object.keys(body.variables)).toEqual([
      'marque',
      'modele',
      'annee',
      'km',
      'prix',
      'ville',
      'site',
      'distance',
      'prenom',
      'nom',
      'concession',
      'ville_concession',
      'telephone',
    ]);
    expect(body.variables.modele).toBe('le modèle (911 Carrera S)');
  });

  it('l’écran Réglages renvoie les réglages tels qu’il les a reçus, mot de passe masqué compris, avec Ruf cochée chez les allemandes et 150 000 km : tout est enregistré et la boîte garde son mot de passe', async () => {
    // Given
    const { application, session } = await signedInApplication();
    await application.server.inject({ method: 'PUT', url: '/api/settings', headers: session, payload: { imap: DEALER_MAILBOX } });
    const opened = (await application.server.inject({ method: 'GET', url: '/api/settings', headers: session })).json().settings;
    const edited = {
      ...opened,
      maxKm: 150000,
      families: {
        ...opened.families,
        allemandes: { ...opened.families.allemandes, brands: [...opened.families.allemandes.brands, 'Ruf'] },
      },
    };

    // When
    const response = await application.server.inject({ method: 'PUT', url: '/api/settings', headers: session, payload: edited });

    // Then
    const saved = application.ports.settings.load();
    expect(response.statusCode).toBe(200);
    expect(response.json().settings.imap.pass).toBe(MASKED);
    expect(saved.imap).toEqual(DEALER_MAILBOX);
    expect(saved.maxKm).toBe(150000);
    expect(saved.families.allemandes.brands).toEqual(['Porsche', 'Mercedes-Benz', 'BMW', 'Audi', 'Alpina', 'Ruf']);
  });

  it('des réglages renvoyés avec le mot de passe de la boîte et le jeton Telegram masqués gardent les secrets enregistrés', async () => {
    // Given
    const { application, session } = await signedInApplication();
    const notifications = { push: true, telegramToken: GARAGE_BOT_TOKEN, telegramChatId: GARAGE_CHAT_ID };
    await application.server.inject({
      method: 'PUT',
      url: '/api/settings',
      headers: session,
      payload: { imap: DEALER_MAILBOX, notifications },
    });

    // When
    const response = await application.server.inject({
      method: 'PUT',
      url: '/api/settings',
      headers: session,
      payload: { imap: { ...DEALER_MAILBOX, pass: MASKED }, notifications: { ...notifications, telegramToken: MASKED }, maxKm: 120000 },
    });

    // Then
    const saved = application.ports.settings.load();
    expect(response.statusCode).toBe(200);
    expect(saved.imap.pass).toBe(DEALER_MAILBOX.pass);
    expect(saved.notifications.telegramToken).toBe(GARAGE_BOT_TOKEN);
    expect(saved.maxKm).toBe(120000);
  });

  it('des réglages qui portent un champ inconnu de l’application sont refusés, et rien n’est enregistré', async () => {
    // Given
    const { application, session } = await signedInApplication();
    const before = application.ports.settings.load();

    // When
    const response = await application.server.inject({
      method: 'PUT',
      url: '/api/settings',
      headers: session,
      payload: { maxKm: 150000, imap: { ...DEALER_MAILBOX, proxy: 'socks5://203.0.113.24:1080' } },
    });

    // Then
    expect({ status: response.statusCode, body: response.json() }).toEqual({ status: 400, body: { error: 'Requête invalide.' } });
    expect(application.ports.settings.load()).toEqual(before);
  });

  it('des réglages envoyés en texte brut, comme le fait le script d’import depuis la page d’un autre site, ne sont pas lus, et rien n’est enregistré', async () => {
    // Given
    const { application, session } = await signedInApplication();

    // When
    const response = await application.server.inject({
      method: 'PUT',
      url: '/api/settings',
      headers: { ...session, 'content-type': 'text/plain;charset=UTF-8' },
      payload: JSON.stringify({ maxKm: 150000 }),
    });

    // Then
    expect({ status: response.statusCode, body: response.json() }).toEqual({ status: 400, body: { error: 'Requête invalide.' } });
    expect(application.ports.settings.load().maxKm).not.toBe(150000);
  });

  it('un site lu directement ajouté sans identifiant ni état en reçoit un, reste activé et s’appelle « Site » sans nom', async () => {
    // Given
    const { application, session } = await signedInApplication();

    // When
    const response = await application.server.inject({
      method: 'PUT',
      url: '/api/settings',
      headers: session,
      payload: { httpSites: [{ name: '   ', url: `  ${LEPARKING_PORSCHE_911}  ` }] },
    });

    // Then
    const [site] = response.json().settings.httpSites;
    expect(response.statusCode).toBe(200);
    expect(site).toEqual({ id: expect.stringMatching(/^[a-z0-9]{8}$/), name: 'Site', url: LEPARKING_PORSCHE_911, enabled: true });
    expect(application.ports.settings.load().httpSites).toEqual([site]);
  });

  it('une ville introuvable désactive le filtre de distance, et l’enregistrement le signale', async () => {
    // Given
    const { application, session } = await signedInApplication();

    // When
    const response = await application.server.inject({
      method: 'PUT',
      url: '/api/settings',
      headers: session,
      payload: { zone: { city: 'Saint-Émilion', postalCode: '', lat: null, lon: null, radiusKm: 100 } },
    });

    // Then
    const body = response.json();
    expect(response.statusCode).toBe(200);
    expect(body.warning).toBe('Ville introuvable : le filtre de distance est désactivé tant que la ville n’est pas reconnue.');
    expect(body.settings.zone).toEqual({ city: 'Saint-Émilion', postalCode: '', lat: null, lon: null, radiusKm: 100 });
    expect(body.preview).toEqual({ total: 0, pass: 0 });
  });

  it('une zone sans ville ni code postal est refusée', async () => {
    // Given
    const { application, session } = await signedInApplication();

    // When
    const response = await application.server.inject({
      method: 'PUT',
      url: '/api/settings',
      headers: session,
      payload: { zone: { city: '  ', postalCode: '', lat: null, lon: null, radiusKm: 100 } },
    });

    // Then
    expect({ status: response.statusCode, body: response.json() }).toEqual({
      status: 400,
      body: { error: 'Indiquez la ville de la zone.' },
    });
  });

  it('l’aperçu de réglages sans ville répond l’erreur sans rien compter, et sans refuser la requête', async () => {
    // Given
    const { application, session } = await signedInApplication();

    // When
    const response = await application.server.inject({
      method: 'POST',
      url: '/api/settings/preview',
      headers: session,
      payload: { zone: { city: '', postalCode: '', lat: null, lon: null, radiusKm: 100 } },
    });

    // Then
    expect({ status: response.statusCode, body: response.json() }).toEqual({
      status: 200,
      body: { error: 'Indiquez la ville de la zone.', pass: 0, total: 0 },
    });
  });
});
