import { describe, expect, it } from 'vitest';
import { DEALER_PHONE } from '../../support/ingestWorld.js';
import { type SignedInApplication, signedInApplication } from '../../support/signedInApplication.js';
import { simulatedPushService } from '../../support/simulatedPushService.js';

const SENT_BY_ANOTHER_PAGE = 'text/plain;charset=UTF-8';

const CAYMAN_FROM_THE_SEARCH_PAGE = {
  site: 'leboncoin',
  externalId: '2811012345',
  url: 'https://www.leboncoin.fr/ad/voitures/2811012345',
  title: 'Porsche Cayman GT4 3.8 385ch',
  price: 89900,
  km: 23000,
  year: 2016,
  city: 'Mérignac',
  postalCode: '33700',
  sellerType: 'particulier',
  publishedAt: '2026-10-12T18:30:00+02:00',
};

const M2_FROM_THE_SEARCH_PAGE = {
  site: 'lacentrale',
  siteLabel: 'La Centrale',
  externalId: '69115730010',
  url: 'https://www.lacentrale.fr/auto-occasion-annonce-69115730010.html',
  title: 'BMW M2 Compétition 3.0 410ch',
  price: 52900,
  km: 38000,
  year: 2019,
  city: 'Pessac',
  postalCode: '33600',
};

const GR_YARIS_FROM_THE_SEARCH_PAGE = {
  site: 'leboncoin',
  externalId: '2811004444',
  url: 'https://www.leboncoin.fr/ad/voitures/2811004444',
  title: 'Toyota GR Yaris 1.6 261ch',
  price: 38900,
  km: 18000,
  year: 2021,
  city: 'Mérignac',
  postalCode: '33700',
  sellerType: 'particulier',
};

const CAYMAN_PAGE_DATE = { site: 'leboncoin', externalId: '2811012345', publishedAt: '2026-10-11' };

const NEVER_RECEIVED_PAGE_DATE = { site: 'leboncoin', externalId: '2899999999', publishedAt: '2026-10-11T08:15:00+02:00' };

async function importTokenOf({ application, session }: SignedInApplication): Promise<string> {
  const response = await application.server.inject({ method: 'GET', url: '/api/import/token', headers: session });
  const body: { readonly token: string } = response.json();
  return body.token;
}

function caymanRecorded({ application }: SignedInApplication): boolean {
  return application.ports.vehicles.findListing('leboncoin', '2811012345') !== undefined;
}

describe('jeton d’import', () => {
  it('le jeton d’import est remis à l’application connectée, le même d’une demande à l’autre', async () => {
    // Given
    const signedIn = await signedInApplication();
    const first = await signedIn.application.server.inject({ method: 'GET', url: '/api/import/token', headers: signedIn.session });

    // When
    const second = await signedIn.application.server.inject({ method: 'GET', url: '/api/import/token', headers: signedIn.session });

    // Then
    expect(first.statusCode).toBe(200);
    expect(first.json()).toEqual({ token: expect.stringMatching(/^[0-9a-f]{48}$/) });
    expect(second.json()).toEqual(first.json());
  });
});

describe('import d’annonces lues sur la page d’un autre site', () => {
  it('la page de recherche Leboncoin ouverte dans le navigateur importe ses annonces en texte brut avec le jeton, sans session : la Cayman retenue, la GR Yaris d’une marque non suivie écartée', async () => {
    // Given
    const signedIn = await signedInApplication();
    const token = await importTokenOf(signedIn);

    // When
    const response = await signedIn.application.server.inject({
      method: 'POST',
      url: '/api/import',
      headers: { 'content-type': SENT_BY_ANOTHER_PAGE },
      payload: JSON.stringify({ token, listings: [CAYMAN_FROM_THE_SEARCH_PAGE, GR_YARIS_FROM_THE_SEARCH_PAGE] }),
    });

    // Then
    expect({ status: response.statusCode, body: response.json() }).toEqual({
      status: 200,
      body: { received: 2, new: 2, matched: 1, seen: 0, skipped: 0 },
    });
    expect(caymanRecorded(signedIn)).toBe(true);
  });

  it('une page qui envoie un jeton faux est refusée, et rien n’est importé', async () => {
    // Given
    const signedIn = await signedInApplication();
    await importTokenOf(signedIn);

    // When
    const response = await signedIn.application.server.inject({
      method: 'POST',
      url: '/api/import',
      headers: { 'content-type': SENT_BY_ANOTHER_PAGE },
      payload: JSON.stringify({ token: '0123456789abcdef0123456789abcdef0123456789abcdef', listings: [CAYMAN_FROM_THE_SEARCH_PAGE] }),
    });

    // Then
    expect({ status: response.statusCode, body: response.json() }).toEqual({ status: 401, body: { error: 'jeton invalide' } });
    expect(caymanRecorded(signedIn)).toBe(false);
  });

  it('un jeton recopié à la main avec une lettre accentuée, de la même longueur que le vrai, est refusé sans faire échouer le serveur', async () => {
    // Given
    const signedIn = await signedInApplication();
    const token = await importTokenOf(signedIn);

    // When
    const response = await signedIn.application.server.inject({
      method: 'POST',
      url: '/api/import',
      headers: { 'content-type': SENT_BY_ANOTHER_PAGE },
      payload: JSON.stringify({ token: `${token.slice(0, -1)}é`, listings: [CAYMAN_FROM_THE_SEARCH_PAGE] }),
    });

    // Then
    expect({ status: response.statusCode, body: response.json() }).toEqual({ status: 401, body: { error: 'jeton invalide' } });
  });

  it('une page dont le script envoie un texte qui n’est pas du JSON est refusée comme un jeton faux', async () => {
    // Given
    const signedIn = await signedInApplication();
    await importTokenOf(signedIn);

    // When
    const response = await signedIn.application.server.inject({
      method: 'POST',
      url: '/api/import',
      headers: { 'content-type': SENT_BY_ANOTHER_PAGE },
      payload: 'Porsche Cayman GT4 3.8 385ch - 89 900 € - Mérignac',
    });

    // Then
    expect({ status: response.statusCode, body: response.json() }).toEqual({ status: 401, body: { error: 'jeton invalide' } });
  });

  it('une page dont le script glisse une clé __proto__ dans l’import en texte brut est refusée comme un jeton faux, même avec le bon jeton, et rien n’est importé', async () => {
    // Given
    const signedIn = await signedInApplication();
    const token = await importTokenOf(signedIn);
    const honestImport = JSON.stringify({ token, listings: [CAYMAN_FROM_THE_SEARCH_PAGE] });

    // When
    const response = await signedIn.application.server.inject({
      method: 'POST',
      url: '/api/import',
      headers: { 'content-type': SENT_BY_ANOTHER_PAGE },
      payload: honestImport.replace('{', '{"__proto__":{"notify":true},'),
    });

    // Then
    expect({ status: response.statusCode, body: response.json() }).toEqual({ status: 401, body: { error: 'jeton invalide' } });
    expect(caymanRecorded(signedIn)).toBe(false);
  });

  it('une page restée sur un ancien script, avec un jeton périmé et une annonce seule au lieu d’une liste, est refusée pour son jeton', async () => {
    // Given
    const signedIn = await signedInApplication();
    await importTokenOf(signedIn);

    // When
    const response = await signedIn.application.server.inject({
      method: 'POST',
      url: '/api/import',
      headers: { 'content-type': SENT_BY_ANOTHER_PAGE },
      payload: JSON.stringify({ token: '0123456789abcdef0123456789abcdef0123456789abcdef', listings: CAYMAN_FROM_THE_SEARCH_PAGE }),
    });

    // Then
    expect({ status: response.statusCode, body: response.json() }).toEqual({ status: 401, body: { error: 'jeton invalide' } });
  });

  it('un import envoyé en JSON, même avec le bon jeton, demande la session de l’application', async () => {
    // Given
    const signedIn = await signedInApplication();
    const token = await importTokenOf(signedIn);

    // When
    const response = await signedIn.application.server.inject({
      method: 'POST',
      url: '/api/import',
      payload: { token, listings: [CAYMAN_FROM_THE_SEARCH_PAGE] },
    });

    // Then
    expect({ status: response.statusCode, body: response.json() }).toEqual({ status: 401, body: { error: 'non connecté' } });
    expect(caymanRecorded(signedIn)).toBe(false);
  });
});

describe('import d’annonces depuis l’application', () => {
  it('un script d’import qui envoie une seule annonce au lieu d’une liste n’a rien à importer', async () => {
    // Given
    const signedIn = await signedInApplication();

    // When
    const response = await signedIn.application.server.inject({
      method: 'POST',
      url: '/api/import',
      headers: signedIn.session,
      payload: { listings: CAYMAN_FROM_THE_SEARCH_PAGE },
    });

    // Then
    expect({ status: response.statusCode, body: response.json() }).toEqual({ status: 400, body: { error: 'Aucune annonce à importer.' } });
  });

  it('un script d’import dont une carte de la page n’a rien donné (null dans la liste) est refusé en entier, sans rien enregistrer', async () => {
    // Given
    const signedIn = await signedInApplication();

    // When
    const response = await signedIn.application.server.inject({
      method: 'POST',
      url: '/api/import',
      headers: signedIn.session,
      payload: { listings: [CAYMAN_FROM_THE_SEARCH_PAGE, null] },
    });

    // Then
    expect({ status: response.statusCode, body: response.json() }).toEqual({ status: 400, body: { error: 'Aucune annonce à importer.' } });
    expect(caymanRecorded(signedIn)).toBe(false);
  });

  it('une annonce retenue importée avec « notify » prévient le téléphone abonné', async () => {
    // Given
    const pushService = simulatedPushService();
    const signedIn = await signedInApplication({ webPush: pushService });
    signedIn.application.ports.subscriptions.save(DEALER_PHONE, signedIn.application.clock.now());

    // When
    await signedIn.application.server.inject({
      method: 'POST',
      url: '/api/import',
      headers: signedIn.session,
      payload: { listings: [CAYMAN_FROM_THE_SEARCH_PAGE], notify: true },
    });

    // Then
    expect(pushService.deliveries().map((delivery) => delivery.endpoint)).toEqual([DEALER_PHONE.endpoint]);
    expect(JSON.parse(pushService.deliveries()[0]?.payload ?? '{}').title).toContain('Porsche');
  });

  it('sans « notify », l’annonce importée ne prévient personne', async () => {
    // Given
    const pushService = simulatedPushService();
    const signedIn = await signedInApplication({ webPush: pushService });
    signedIn.application.ports.subscriptions.save(DEALER_PHONE, signedIn.application.clock.now());

    // When
    const response = await signedIn.application.server.inject({
      method: 'POST',
      url: '/api/import',
      headers: signedIn.session,
      payload: { listings: [CAYMAN_FROM_THE_SEARCH_PAGE] },
    });

    // Then
    expect(response.json()).toEqual({ received: 1, new: 1, matched: 1, seen: 0, skipped: 0 });
    expect(pushService.deliveries()).toEqual([]);
  });

  it('la même page La Centrale importée deux fois : la seconde fois, la M2 est comptée déjà vue, sans voiture en double', async () => {
    // Given
    const signedIn = await signedInApplication();
    const importOnce = () =>
      signedIn.application.server.inject({
        method: 'POST',
        url: '/api/import',
        headers: signedIn.session,
        payload: { listings: [M2_FROM_THE_SEARCH_PAGE] },
      });
    await importOnce();

    // When
    const response = await importOnce();

    // Then
    expect(response.json()).toEqual({ received: 1, new: 0, matched: 0, seen: 1, skipped: 0 });
    expect(signedIn.application.ports.vehicles.allVehicles().map((vehicle) => `${vehicle.make} ${vehicle.model}`)).toEqual([
      'BMW M2 Compétition',
    ]);
  });
});

describe('dates de mise en ligne relevées sur les pages d’annonces', () => {
  it('les dates relevées en texte brut avec le jeton complètent l’annonce déjà importée, et celle d’une annonce jamais reçue est comptée inconnue', async () => {
    // Given
    const signedIn = await signedInApplication();
    const token = await importTokenOf(signedIn);
    await signedIn.application.server.inject({
      method: 'POST',
      url: '/api/import',
      headers: signedIn.session,
      payload: { listings: [CAYMAN_FROM_THE_SEARCH_PAGE] },
    });

    // When
    const response = await signedIn.application.server.inject({
      method: 'POST',
      url: '/api/import/dates',
      headers: { 'content-type': SENT_BY_ANOTHER_PAGE },
      payload: JSON.stringify({ token, items: [CAYMAN_PAGE_DATE, NEVER_RECEIVED_PAGE_DATE] }),
    });

    // Then
    expect({ status: response.statusCode, body: response.json() }).toEqual({
      status: 200,
      body: { received: 2, updated: 1, unknown: 1, skipped: 0 },
    });
    expect(signedIn.application.ports.vehicles.findListing('leboncoin', '2811012345')?.vehicle.publishedAt).toBe(
      '2026-10-11T00:00:00.000Z',
    );
  });

  it('des dates envoyées par une page avec un jeton faux sont refusées', async () => {
    // Given
    const signedIn = await signedInApplication();
    await importTokenOf(signedIn);

    // When
    const response = await signedIn.application.server.inject({
      method: 'POST',
      url: '/api/import/dates',
      headers: { 'content-type': SENT_BY_ANOTHER_PAGE },
      payload: JSON.stringify({ token: 'jeton-recopie-a-la-main', items: [CAYMAN_PAGE_DATE] }),
    });

    // Then
    expect({ status: response.statusCode, body: response.json() }).toEqual({ status: 401, body: { error: 'jeton invalide' } });
  });

  it('un script qui envoie une seule date au lieu d’une liste n’a rien à enregistrer', async () => {
    // Given
    const signedIn = await signedInApplication();

    // When
    const response = await signedIn.application.server.inject({
      method: 'POST',
      url: '/api/import/dates',
      headers: signedIn.session,
      payload: { items: CAYMAN_PAGE_DATE },
    });

    // Then
    expect({ status: response.statusCode, body: response.json() }).toEqual({ status: 400, body: { error: 'Aucune date à enregistrer.' } });
  });
});
