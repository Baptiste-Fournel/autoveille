import { describe, expect, it, onTestFinished } from 'vitest';
import { type LegacyApp, type LegacyAppOptions, type LegacyResponse, OWNER_PASSWORD, startLegacyApp } from './legacyApp.js';
import { withoutVolatileValues } from './volatileValues.js';

const PORSCHE_911_PRICE_DROP = ['leboncoin', '2811001234'] as const;
const MERCEDES_C63_REPOSTED = ['lacentrale', '69112345678'] as const;
const FORD_MUSTANG = ['leboncoin', '2811005678'] as const;
const AUDI_A3_NOT_SPECIAL = ['leboncoin', '2811007777'] as const;
const PEUGEOT_205_GTI = ['leboncoin', '2811006666'] as const;
const PORSCHE_944_REPLIED = ['leboncoin', '2810004321'] as const;
const BMW_M3_E46_128000_KM = ['leboncoin', '2811009999'] as const;
const IMAP_ACCOUNT = { host: 'imap.gmail.com', port: 993, user: 'concession.veille@example.com', mailbox: 'INBOX' } as const;

async function freshApp(options?: LegacyAppOptions): Promise<LegacyApp> {
  const app = await startLegacyApp(options);
  onTestFinished(() => app.stop());
  return app;
}

async function signedIn(): Promise<{ readonly app: LegacyApp; readonly session: string }> {
  const app = await freshApp();
  const session = await app.signIn();
  return { app, session };
}

function contract(response: LegacyResponse): { readonly status: number; readonly body: unknown } {
  return { status: response.status, body: withoutVolatileValues(response.body) };
}

function fieldOf(body: unknown, ...path: readonly string[]): unknown {
  return path.reduce<unknown>((value, key) => {
    if (typeof value !== 'object' || value === null) throw new Error(`Champ ${path.join('.')} absent de la réponse`);
    return Object.entries(value).find(([name]) => name === key)?.[1];
  }, body);
}

function textField(body: unknown, field: string): string {
  const value = fieldOf(body, field);
  if (typeof value !== 'string') throw new Error(`Champ ${field} absent`);
  return value;
}

function verdictsOf(body: unknown): readonly unknown[] {
  const vehicles = fieldOf(body, 'vehicles');
  if (!Array.isArray(vehicles)) throw new Error('Réponse sans liste d’annonces');
  return vehicles.map((vehicle: unknown) =>
    withoutVolatileValues({
      name: fieldOf(vehicle, 'name'),
      family: fieldOf(vehicle, 'family'),
      matched: fieldOf(vehicle, 'matched'),
      reasons: fieldOf(vehicle, 'reasons'),
      distanceKm: fieldOf(vehicle, 'distanceKm'),
      status: fieldOf(vehicle, 'status'),
    }),
  );
}

function datesOf(body: unknown): readonly unknown[] {
  const vehicles = fieldOf(body, 'vehicles');
  if (!Array.isArray(vehicles)) throw new Error('Réponse sans liste d’annonces');
  return vehicles.map((vehicle: unknown) =>
    withoutVolatileValues({
      name: fieldOf(vehicle, 'name'),
      publishedAt: fieldOf(vehicle, 'publishedAt'),
      firstSeenAt: fieldOf(vehicle, 'firstSeenAt'),
    }),
  );
}

describe('première connexion', () => {
  it('le concessionnaire choisit son mot de passe depuis la machine qui héberge l’application', async () => {
    // Given
    const app = await freshApp();

    // When
    const response = await app.request({ method: 'POST', url: '/api/setup', payload: { password: OWNER_PASSWORD } });

    // Then
    const { status, body } = contract(response);
    expect({ status, body, cookie: response.sessionCookie, cookieAttributes: response.cookieAttributes }).toMatchSnapshot();
  });

  it('un mot de passe de moins de huit caractères est refusé', async () => {
    // Given
    const app = await freshApp();

    // When
    const response = await app.request({ method: 'POST', url: '/api/setup', payload: { password: 'porsche' } });

    // Then
    const { status, body } = contract(response);
    expect({ status, body, cookie: response.sessionCookie, cookieAttributes: response.cookieAttributes }).toMatchSnapshot();
  });

  it('une seconde première connexion est refusée une fois le mot de passe choisi', async () => {
    // Given
    const { app } = await signedIn();

    // When
    const response = await app.request({ method: 'POST', url: '/api/setup', payload: { password: 'un-autre-mot-de-passe' } });

    // Then
    const { status, body } = contract(response);
    expect({ status, body, cookie: response.sessionCookie, cookieAttributes: response.cookieAttributes }).toMatchSnapshot();
  });

  it('avec un code de première connexion configuré, un code faux est refusé', async () => {
    // Given
    const app = await freshApp({ setupCode: '4821-7730' });

    // When
    const response = await app.request({
      method: 'POST',
      url: '/api/setup',
      payload: { setupCode: '4821-7731', password: OWNER_PASSWORD },
      remoteAddress: '203.0.113.24',
    });

    // Then
    const { status, body } = contract(response);
    expect({ status, body, cookie: response.sessionCookie, cookieAttributes: response.cookieAttributes }).toMatchSnapshot();
  });

  it('avec un code de première connexion configuré, le bon code ouvre la session depuis le téléphone', async () => {
    // Given
    const app = await freshApp({ setupCode: '4821-7730' });

    // When
    const response = await app.request({
      method: 'POST',
      url: '/api/setup',
      payload: { setupCode: ' 4821-7730 ', password: OWNER_PASSWORD },
      remoteAddress: '203.0.113.24',
    });

    // Then
    const { status, body } = contract(response);
    expect({ status, body, cookie: response.sessionCookie, cookieAttributes: response.cookieAttributes }).toMatchSnapshot();
  });

  it('sans code configuré, la première connexion depuis le téléphone est refusée', async () => {
    // Given
    const app = await freshApp();

    // When
    const response = await app.request({
      method: 'POST',
      url: '/api/setup',
      payload: { password: OWNER_PASSWORD },
      remoteAddress: '203.0.113.24',
    });

    // Then
    const { status, body } = contract(response);
    expect({ status, body, cookie: response.sessionCookie, cookieAttributes: response.cookieAttributes }).toMatchSnapshot();
  });
});

describe('première connexion derrière le proxy', () => {
  it('derrière le proxy HTTPS, le cookie de session n’est envoyé qu’en HTTPS', async () => {
    // Given
    const app = await freshApp();

    // When
    const response = await app.request({
      method: 'POST',
      url: '/api/setup',
      payload: { password: OWNER_PASSWORD },
      headers: { 'x-forwarded-proto': 'https' },
    });

    // Then
    const { status, body } = contract(response);
    expect({ status, body, cookie: response.sessionCookie, cookieAttributes: response.cookieAttributes }).toMatchSnapshot();
  });

  it('une première connexion relayée avec X-Forwarded-For 127.0.0.1 passe pour la machine elle-même', async () => {
    // Given
    const app = await freshApp();

    // When
    const response = await app.request({
      method: 'POST',
      url: '/api/setup',
      payload: { password: OWNER_PASSWORD },
      remoteAddress: '203.0.113.24',
      headers: { 'x-forwarded-for': '127.0.0.1' },
    });

    // Then
    const { status, body } = contract(response);
    expect({ status, body, cookie: response.sessionCookie, cookieAttributes: response.cookieAttributes }).toMatchSnapshot();
  });

  it('après huit codes faux depuis le téléphone, même le bon code est refusé', async () => {
    // Given
    const app = await freshApp({ setupCode: '4821-7730' });
    for (const attempt of [1, 2, 3, 4, 5, 6, 7, 8]) {
      await app.request({
        method: 'POST',
        url: '/api/setup',
        payload: { setupCode: `4821-773${attempt + 1}`, password: OWNER_PASSWORD },
        remoteAddress: '203.0.113.24',
      });
    }

    // When
    const response = await app.request({
      method: 'POST',
      url: '/api/setup',
      payload: { setupCode: '4821-7730', password: OWNER_PASSWORD },
      remoteAddress: '203.0.113.24',
    });

    // Then
    const { status, body } = contract(response);
    expect({ status, body, cookie: response.sessionCookie, cookieAttributes: response.cookieAttributes }).toMatchSnapshot();
  });
});

describe('connexion', () => {
  it('le bon mot de passe ouvre une session sur un nouvel appareil', async () => {
    // Given
    const { app } = await signedIn();

    // When
    const response = await app.request({ method: 'POST', url: '/api/login', payload: { password: OWNER_PASSWORD } });

    // Then
    const { status, body } = contract(response);
    expect({ status, body, cookie: response.sessionCookie, cookieAttributes: response.cookieAttributes }).toMatchSnapshot();
  });

  it('un mauvais mot de passe est refusé', async () => {
    // Given
    const { app } = await signedIn();

    // When
    const response = await app.request({ method: 'POST', url: '/api/login', payload: { password: 'garage-bordeaux-2025' } });

    // Then
    const { status, body } = contract(response);
    expect({ status, body, cookie: response.sessionCookie, cookieAttributes: response.cookieAttributes }).toMatchSnapshot();
  });

  it('se connecter avant d’avoir choisi le mot de passe renvoie vers la première connexion', async () => {
    // Given
    const app = await freshApp();

    // When
    const response = await app.request({ method: 'POST', url: '/api/login', payload: { password: OWNER_PASSWORD } });

    // Then
    const { status, body } = contract(response);
    expect({ status, body, cookie: response.sessionCookie, cookieAttributes: response.cookieAttributes }).toMatchSnapshot();
  });

  it('après huit mots de passe faux, même le bon est refusé', async () => {
    // Given
    const { app } = await signedIn();
    for (const attempt of [1, 2, 3, 4, 5, 6, 7, 8]) {
      await app.request({ method: 'POST', url: '/api/login', payload: { password: `essai-${attempt}` } });
    }

    // When
    const response = await app.request({ method: 'POST', url: '/api/login', payload: { password: OWNER_PASSWORD } });

    // Then
    const { status, body } = contract(response);
    expect({ status, body, cookie: response.sessionCookie, cookieAttributes: response.cookieAttributes }).toMatchSnapshot();
  });
});

describe('session', () => {
  it('se déconnecter efface le cookie de session', async () => {
    // Given
    const { app, session } = await signedIn();

    // When
    const response = await app.request({ method: 'POST', url: '/api/logout', session });

    // Then
    const { status, body } = contract(response);
    expect({ status, body, cookie: response.sessionCookie, cookieAttributes: response.cookieAttributes }).toMatchSnapshot();
  });

  it('après déconnexion, l’ancien cookie ne donne plus accès', async () => {
    // Given
    const { app, session } = await signedIn();
    await app.request({ method: 'POST', url: '/api/logout', session });

    // When
    const response = await app.request({ method: 'GET', url: '/api/overview', session });

    // Then
    const { status, body } = contract(response);
    expect({ status, body }).toMatchSnapshot();
  });

  it('un cookie de session falsifié, sans sa signature, est refusé', async () => {
    // Given
    const { app, session } = await signedIn();
    const unsignedToken = session.split('.')[0] ?? '';

    // When
    const response = await app.request({ method: 'GET', url: '/api/overview', session: unsignedToken });

    // Then
    const { status, body } = contract(response);
    expect({ status, body }).toMatchSnapshot();
  });

  it('se déconnecter sur un appareil dont la session n’existe plus répond non connecté', async () => {
    // Given
    const { app, session } = await signedIn();
    await app.request({ method: 'POST', url: '/api/logout', session });

    // When
    const response = await app.request({ method: 'POST', url: '/api/logout', session });

    // Then
    const { status, body } = contract(response);
    expect({ status, body, cookie: response.sessionCookie, cookieAttributes: response.cookieAttributes }).toMatchSnapshot();
  });

  it('à la première visite, l’application demande de choisir le mot de passe', async () => {
    // Given
    const app = await freshApp();

    // When
    const response = await app.request({ method: 'GET', url: '/api/me' });

    // Then
    const { status, body } = contract(response);
    expect({ status, body }).toMatchSnapshot();
  });

  it('un appareil sans session alors que le mot de passe est déjà choisi', async () => {
    // Given
    const { app } = await signedIn();

    // When
    const response = await app.request({ method: 'GET', url: '/api/me' });

    // Then
    const { status, body } = contract(response);
    expect({ status, body }).toMatchSnapshot();
  });

  it('un appareil connecté', async () => {
    // Given
    const { app, session } = await signedIn();

    // When
    const response = await app.request({ method: 'GET', url: '/api/me', session });

    // Then
    const { status, body } = contract(response);
    expect({ status, body }).toMatchSnapshot();
  });

  it('une page protégée demandée sans session est refusée', async () => {
    // Given
    const { app } = await signedIn();

    // When
    const response = await app.request({ method: 'GET', url: '/api/overview' });

    // Then
    const { status, body } = contract(response);
    expect({ status, body }).toMatchSnapshot();
  });

  it('une adresse d’API inconnue répond introuvable', async () => {
    // Given
    const { app, session } = await signedIn();

    // When
    const response = await app.request({ method: 'GET', url: '/api/annonces', session });

    // Then
    const { status, body } = contract(response);
    expect({ status, body }).toMatchSnapshot();
  });
});

describe('accueil', () => {
  it('l’accueil résume la semaine, les sources et les alertes de site à revoir', async () => {
    // Given
    const { app, session } = await signedIn();

    // When
    const response = await app.request({ method: 'GET', url: '/api/overview', session });

    // Then
    const { status, body } = contract(response);
    expect({ status, body }).toMatchSnapshot();
  });
});

describe('liste des annonces retenues', () => {
  it('par défaut, la liste montre les annonces nouvelles', async () => {
    // Given
    const { app, session } = await signedIn();

    // When
    const response = await app.request({ method: 'GET', url: '/api/vehicles', session });

    // Then
    const { status, body } = contract(response);
    expect({ status, body }).toMatchSnapshot();
  });

  it('l’onglet des vendeurs contactés', async () => {
    // Given
    const { app, session } = await signedIn();

    // When
    const response = await app.request({ method: 'GET', url: '/api/vehicles?status=contacte', session });

    // Then
    const { status, body } = contract(response);
    expect({ status, body }).toMatchSnapshot();
  });

  it('l’onglet des vendeurs qui ont répondu', async () => {
    // Given
    const { app, session } = await signedIn();

    // When
    const response = await app.request({ method: 'GET', url: '/api/vehicles?status=repondu', session });

    // Then
    const { status, body } = contract(response);
    expect({ status, body }).toMatchSnapshot();
  });

  it('l’onglet des annonces ignorées', async () => {
    // Given
    const { app, session } = await signedIn();

    // When
    const response = await app.request({ method: 'GET', url: '/api/vehicles?status=ignore', session });

    // Then
    const { status, body } = contract(response);
    expect({ status, body }).toMatchSnapshot();
  });

  it('toutes les annonces retenues, quel que soit leur suivi', async () => {
    // Given
    const { app, session } = await signedIn();

    // When
    const response = await app.request({ method: 'GET', url: '/api/vehicles?status=tous', session });

    // Then
    const { status, body } = contract(response);
    expect({ status, body }).toMatchSnapshot();
  });

  it('un onglet inconnu retombe sur les annonces nouvelles', async () => {
    // Given
    const { app, session } = await signedIn();

    // When
    const response = await app.request({ method: 'GET', url: '/api/vehicles?status=vendu', session });

    // Then
    const { status, body } = contract(response);
    expect({ status, body }).toMatchSnapshot();
  });

  it('limitée aux trois derniers jours, la liste laisse de côté la voiture vue la semaine dernière', async () => {
    // Given
    const { app, session } = await signedIn();

    // When
    const response = await app.request({ method: 'GET', url: '/api/vehicles?status=tous&days=3', session });

    // Then
    const { status, body } = contract(response);
    expect({ status, body }).toMatchSnapshot();
  });

  it('limitée à deux annonces, la liste garde les plus récentes', async () => {
    // Given
    const { app, session } = await signedIn();

    // When
    const response = await app.request({ method: 'GET', url: '/api/vehicles?limit=2', session });

    // Then
    const { status, body } = contract(response);
    expect({ status, body }).toMatchSnapshot();
  });
});

describe('annonces écartées', () => {
  it('par défaut, les écartées montrent celles des marques suivies', async () => {
    // Given
    const { app, session } = await signedIn();

    // When
    const response = await app.request({ method: 'GET', url: '/api/vehicles?status=ecartees', session });

    // Then
    const { status, body } = contract(response);
    expect({ status, body }).toMatchSnapshot();
  });

  it.each([
    ['toutes les écartées, marques non suivies comprises', 'tous'],
    ['les écartées trop loin de la concession', 'loin'],
    ['les écartées pour leur kilométrage', 'km'],
    ['les écartées qui ne sont ni supercar ni collection', 'special'],
    ['les écartées vendues par un professionnel', 'pro'],
    ['les écartées pour leur marque', 'marque'],
  ])('%s', async (_situation, kind) => {
    // Given
    const { app, session } = await signedIn();

    // When
    const response = await app.request({ method: 'GET', url: `/api/vehicles?status=ecartees&kind=${kind}`, session });

    // Then
    const { status, body } = contract(response);
    expect({ status, body }).toMatchSnapshot();
  });
});

describe('fiche d’une annonce', () => {
  it('la fiche d’une Porsche dont le prix a baissé montre l’historique de prix et les événements', async () => {
    // Given
    const { app, session } = await signedIn();
    const id = app.vehicleIdOf(...PORSCHE_911_PRICE_DROP);

    // When
    const response = await app.request({ method: 'GET', url: `/api/vehicles/${id}`, session });

    // Then
    const { status, body } = contract(response);
    expect({ status, body }).toMatchSnapshot();
  });

  it('la fiche d’une Mercedes republiée sur La Centrale montre ses deux annonces', async () => {
    // Given
    const { app, session } = await signedIn();
    const id = app.vehicleIdOf(...MERCEDES_C63_REPOSTED);

    // When
    const response = await app.request({ method: 'GET', url: `/api/vehicles/${id}`, session });

    // Then
    const { status, body } = contract(response);
    expect({ status, body }).toMatchSnapshot();
  });

  it('la fiche d’une annonce inconnue est introuvable', async () => {
    // Given
    const { app, session } = await signedIn();

    // When
    const response = await app.request({ method: 'GET', url: '/api/vehicles/9999', session });

    // Then
    const { status, body } = contract(response);
    expect({ status, body }).toMatchSnapshot();
  });

  it('une fiche demandée avec un identifiant qui n’est pas un numéro est introuvable', async () => {
    // Given
    const { app, session } = await signedIn();

    // When
    const response = await app.request({ method: 'GET', url: '/api/vehicles/abc', session });

    // Then
    const { status, body } = contract(response);
    expect({ status, body }).toMatchSnapshot();
  });
});

describe('suivi d’une annonce', () => {
  it('le concessionnaire marque la Mustang comme contactée', async () => {
    // Given
    const { app, session } = await signedIn();
    const id = app.vehicleIdOf(...FORD_MUSTANG);

    // When
    const response = await app.request({ method: 'POST', url: `/api/vehicles/${id}`, payload: { status: 'contacte' }, session });

    // Then
    const { status, body } = contract(response);
    expect({ status, body }).toMatchSnapshot();
  });

  it('revenir à « nouvelle » après un appui par erreur sur « contactée » efface le contact', async () => {
    // Given
    const { app, session } = await signedIn();
    const id = app.vehicleIdOf(...FORD_MUSTANG);
    await app.request({ method: 'POST', url: `/api/vehicles/${id}`, payload: { status: 'contacte' }, session });

    // When
    const response = await app.request({ method: 'POST', url: `/api/vehicles/${id}`, payload: { status: 'nouveau' }, session });

    // Then
    const { status, body } = contract(response);
    expect({ status, body }).toMatchSnapshot();
  });

  it('repasser en « contactée » une annonce dont le vendeur a répondu efface la réponse', async () => {
    // Given
    const { app, session } = await signedIn();
    const id = app.vehicleIdOf(...PORSCHE_944_REPLIED);

    // When
    const response = await app.request({ method: 'POST', url: `/api/vehicles/${id}`, payload: { status: 'contacte' }, session });

    // Then
    const { status, body } = contract(response);
    expect({ status, body }).toMatchSnapshot();
  });

  it('un statut inconnu est refusé', async () => {
    // Given
    const { app, session } = await signedIn();
    const id = app.vehicleIdOf(...FORD_MUSTANG);

    // When
    const response = await app.request({ method: 'POST', url: `/api/vehicles/${id}`, payload: { status: 'vendu' }, session });

    // Then
    const { status, body } = contract(response);
    expect({ status, body }).toMatchSnapshot();
  });

  it('le concessionnaire note le rendez-vous pris avec le vendeur', async () => {
    // Given
    const { app, session } = await signedIn();
    const id = app.vehicleIdOf(...FORD_MUSTANG);

    // When
    const response = await app.request({
      method: 'POST',
      url: `/api/vehicles/${id}`,
      payload: { note: 'Rendez-vous samedi 10 h à Arcachon, carnet d’entretien à vérifier.' },
      session,
    });

    // Then
    const { status, body } = contract(response);
    expect({ status, body }).toMatchSnapshot();
  });

  it('le concessionnaire efface la note devenue inutile', async () => {
    // Given
    const { app, session } = await signedIn();
    const id = app.vehicleIdOf(...FORD_MUSTANG);
    await app.request({ method: 'POST', url: `/api/vehicles/${id}`, payload: { note: 'Rappeler lundi.' }, session });

    // When
    const response = await app.request({ method: 'POST', url: `/api/vehicles/${id}`, payload: { note: '   ' }, session });

    // Then
    const { status, body } = contract(response);
    expect({ status, body }).toMatchSnapshot();
  });

  it('le concessionnaire réécrit le message proposé', async () => {
    // Given
    const { app, session } = await signedIn();
    const id = app.vehicleIdOf(...FORD_MUSTANG);

    // When
    const response = await app.request({
      method: 'POST',
      url: `/api/vehicles/${id}`,
      payload: { message: 'Bonjour, votre Mustang GT m’intéresse pour le showroom. Je peux passer la voir cette semaine ?' },
      session,
    });

    // Then
    const { status, body } = contract(response);
    expect({ status, body }).toMatchSnapshot();
  });

  it('le concessionnaire rétablit le message proposé après l’avoir réécrit', async () => {
    // Given
    const { app, session } = await signedIn();
    const id = app.vehicleIdOf(...FORD_MUSTANG);
    await app.request({ method: 'POST', url: `/api/vehicles/${id}`, payload: { message: 'Bonjour, toujours en vente ?' }, session });

    // When
    const response = await app.request({ method: 'POST', url: `/api/vehicles/${id}`, payload: { message: null }, session });

    // Then
    const { status, body } = contract(response);
    expect({ status, body }).toMatchSnapshot();
  });

  it('vider le message réécrit rétablit le message proposé', async () => {
    // Given
    const { app, session } = await signedIn();
    const id = app.vehicleIdOf(...FORD_MUSTANG);
    await app.request({ method: 'POST', url: `/api/vehicles/${id}`, payload: { message: 'Bonjour, toujours en vente ?' }, session });

    // When
    const response = await app.request({ method: 'POST', url: `/api/vehicles/${id}`, payload: { message: '   ' }, session });

    // Then
    const { status, body } = contract(response);
    expect({ status, message: fieldOf(body, 'message'), messageEdited: fieldOf(body, 'messageEdited') }).toMatchSnapshot();
  });

  it('une note collée de plus de 2 000 caractères est coupée à 2 000', async () => {
    // Given
    const { app, session } = await signedIn();
    const id = app.vehicleIdOf(...FORD_MUSTANG);
    const pastedAd = 'Mustang GT 5.0 V8 Fastback, première main, carnet complet, pneus neufs. '.repeat(40);

    // When
    const response = await app.request({ method: 'POST', url: `/api/vehicles/${id}`, payload: { note: pastedAd }, session });

    // Then
    expect(response.status).toBe(200);
    expect(fieldOf(response.body, 'note')).toBe(pastedAd.slice(0, 2000));
  });

  it('le concessionnaire garde quand même une Audi écartée', async () => {
    // Given
    const { app, session } = await signedIn();
    const id = app.vehicleIdOf(...AUDI_A3_NOT_SPECIAL);

    // When
    const response = await app.request({ method: 'POST', url: `/api/vehicles/${id}`, payload: { keep: true }, session });

    // Then
    const { status, body } = contract(response);
    expect({ status, body }).toMatchSnapshot();
  });

  it('ne plus contacter un vendeur range l’annonce dans les ignorées', async () => {
    // Given
    const { app, session } = await signedIn();
    const id = app.vehicleIdOf(...PEUGEOT_205_GTI);

    // When
    const response = await app.request({ method: 'POST', url: `/api/vehicles/${id}`, payload: { doNotContact: true }, session });

    // Then
    const { status, body } = contract(response);
    expect({ status, body }).toMatchSnapshot();
  });

  it('lever « ne plus contacter » laisse l’annonce dans les ignorées', async () => {
    // Given
    const { app, session } = await signedIn();
    const id = app.vehicleIdOf(...PEUGEOT_205_GTI);
    await app.request({ method: 'POST', url: `/api/vehicles/${id}`, payload: { doNotContact: true }, session });

    // When
    const response = await app.request({ method: 'POST', url: `/api/vehicles/${id}`, payload: { doNotContact: false }, session });

    // Then
    const { status, body } = contract(response);
    expect({ status, body }).toMatchSnapshot();
  });

  it('modifier une annonce inconnue est introuvable', async () => {
    // Given
    const { app, session } = await signedIn();

    // When
    const response = await app.request({ method: 'POST', url: '/api/vehicles/9999', payload: { status: 'contacte' }, session });

    // Then
    const { status, body } = contract(response);
    expect({ status, body }).toMatchSnapshot();
  });
});

describe('suppression d’une annonce', () => {
  it('le concessionnaire supprime une annonce mal lue', async () => {
    // Given
    const { app, session } = await signedIn();
    const id = app.vehicleIdOf(...AUDI_A3_NOT_SPECIAL);

    // When
    const response = await app.request({ method: 'DELETE', url: `/api/vehicles/${id}`, session });

    // Then
    const { status, body } = contract(response);
    expect({ status, body }).toMatchSnapshot();
  });

  it('l’annonce supprimée n’a plus de fiche', async () => {
    // Given
    const { app, session } = await signedIn();
    const id = app.vehicleIdOf(...AUDI_A3_NOT_SPECIAL);
    await app.request({ method: 'DELETE', url: `/api/vehicles/${id}`, session });

    // When
    const response = await app.request({ method: 'GET', url: `/api/vehicles/${id}`, session });

    // Then
    const { status, body } = contract(response);
    expect({ status, body }).toMatchSnapshot();
  });

  it('supprimer une annonce inconnue est introuvable', async () => {
    // Given
    const { app, session } = await signedIn();

    // When
    const response = await app.request({ method: 'DELETE', url: '/api/vehicles/9999', session });

    // Then
    const { status, body } = contract(response);
    expect({ status, body }).toMatchSnapshot();
  });
});

describe('réglages', () => {
  it('les réglages arrivent avec le mot de passe de la boîte masqué, les variables et les familles', async () => {
    // Given
    const { app, session } = await signedIn();
    await app.request({
      method: 'PUT',
      url: '/api/settings',
      payload: { imap: { ...IMAP_ACCOUNT, pass: 'abcd efgh ijkl mnop' } },
      session,
    });

    // When
    const response = await app.request({ method: 'GET', url: '/api/settings', session });

    // Then
    const { status, body } = contract(response);
    expect({ status, body }).toMatchSnapshot();
  });

  it('le jeton Telegram enregistré revient en clair dans les réglages', async () => {
    // Given
    const { app, session } = await signedIn();
    await app.request({
      method: 'PUT',
      url: '/api/settings',
      payload: { notifications: { push: true, telegramToken: '110201543:jeton-de-bot-de-test', telegramChatId: '987654321' } },
      session,
    });

    // When
    const response = await app.request({ method: 'GET', url: '/api/settings', session });

    // Then
    const { status, body } = contract(response);
    expect({ status, body }).toMatchSnapshot();
  });

  it('le concessionnaire enregistre ses coordonnées', async () => {
    // Given
    const { app, session } = await signedIn();

    // When
    const response = await app.request({
      method: 'PUT',
      url: '/api/settings',
      payload: {
        dealer: { firstName: 'Julien', lastName: 'Lambert', company: 'Lambert Automobiles', city: 'Bordeaux', phone: '05 56 00 00 00' },
      },
      session,
    });

    // Then
    const { status, body } = contract(response);
    expect({ status, body }).toMatchSnapshot();
  });

  it('une zone sans ville ni code postal est refusée', async () => {
    // Given
    const { app, session } = await signedIn();

    // When
    const response = await app.request({
      method: 'PUT',
      url: '/api/settings',
      payload: { zone: { city: '  ', postalCode: '', lat: null, lon: null, radiusKm: 100 } },
      session,
    });

    // Then
    const { status, body } = contract(response);
    expect({ status, body }).toMatchSnapshot();
  });

  it('le mot de passe masqué renvoyé par le formulaire conserve celui de la boîte', async () => {
    // Given
    const { app, session } = await signedIn();
    await app.request({
      method: 'PUT',
      url: '/api/settings',
      payload: { imap: { ...IMAP_ACCOUNT, pass: 'abcd efgh ijkl mnop' } },
      session,
    });

    // When
    const response = await app.request({
      method: 'PUT',
      url: '/api/settings',
      payload: { imap: { ...IMAP_ACCOUNT, pass: '••••••••' }, maxKm: 120000 },
      session,
    });

    // Then
    const { status, body } = contract(response);
    expect({ status, body }).toMatchSnapshot();
    expect(app.storedImapPassword()).toBe('abcd efgh ijkl mnop');
  });

  it('une ville introuvable désactive le filtre de distance avec un avertissement', async () => {
    // Given
    const { app, session } = await signedIn();

    // When
    const response = await app.request({
      method: 'PUT',
      url: '/api/settings',
      payload: { zone: { city: 'Saint-Émilion', postalCode: '', lat: null, lon: null, radiusKm: 100 } },
      session,
    });

    // Then
    const { status, body } = contract(response);
    expect({ status, body }).toMatchSnapshot();
  });

  it('une ville absente de la table, avec son code postal, se rabat sur le centre du département', async () => {
    // Given
    const { app, session } = await signedIn();

    // When
    const response = await app.request({
      method: 'PUT',
      url: '/api/settings',
      payload: { zone: { city: 'Saint-Émilion', postalCode: '33330', lat: null, lon: null, radiusKm: 100 } },
      session,
    });

    // Then
    const { status, body } = contract(response);
    expect({ status, body }).toMatchSnapshot();
  });

  it('élargir le kilométrage à 150 000 km fait passer la BMW M3 des écartées aux retenues', async () => {
    // Given
    const { app, session } = await signedIn();
    const bmw = app.vehicleIdOf(...BMW_M3_E46_128000_KM);

    // When
    const saved = await app.request({ method: 'PUT', url: '/api/settings', payload: { maxKm: 150000 }, session });

    // Then
    const rejectedForKm = await app.request({ method: 'GET', url: '/api/vehicles?status=ecartees&kind=km', session });
    const kept = await app.request({ method: 'GET', url: '/api/vehicles?status=tous', session });
    const sheet = await app.request({ method: 'GET', url: `/api/vehicles/${bmw}`, session });
    expect({
      status: saved.status,
      preview: withoutVolatileValues(fieldOf(saved.body, 'preview')),
      rejectedForKm: { kinds: fieldOf(rejectedForKm.body, 'kinds'), vehicles: verdictsOf(rejectedForKm.body) },
      kept: verdictsOf(kept.body),
      bmw: { matched: fieldOf(sheet.body, 'matched'), reasons: fieldOf(sheet.body, 'reasons') },
    }).toMatchSnapshot();
  });

  it('un site lu directement ajouté sans nom s’appelle « Site » et garde son dernier passage', async () => {
    // Given
    const { app, session } = await signedIn();

    // When
    const saved = await app.request({
      method: 'PUT',
      url: '/api/settings',
      payload: { httpSites: [{ id: 'k3v9q2xa', name: '   ', url: '  https://www.leparking.fr/voiture-occasion/porsche-911.html  ' }] },
      session,
    });

    // Then
    const sources = await app.request({ method: 'GET', url: '/api/sources', session });
    expect({
      status: saved.status,
      saved: withoutVolatileValues(fieldOf(saved.body, 'settings', 'httpSites')),
      shown: withoutVolatileValues(fieldOf(sources.body, 'httpSites')),
    }).toMatchSnapshot();
  });

  it('des réglages ouverts avant la confirmation La Centrale ne l’effacent pas en étant enregistrés', async () => {
    // Given
    const { app, session } = await signedIn();

    // When
    const saved = await app.request({ method: 'PUT', url: '/api/settings', payload: { alerts: {}, alertsDone: {} }, session });

    // Then
    const overview = await app.request({ method: 'GET', url: '/api/overview', session });
    expect({
      status: saved.status,
      alerts: withoutVolatileValues(fieldOf(saved.body, 'settings', 'alerts')),
      alertsDone: fieldOf(saved.body, 'settings', 'alertsDone'),
      overview: { alertsDone: fieldOf(overview.body, 'alertsDone'), alertIssues: fieldOf(overview.body, 'alertIssues') },
    }).toMatchSnapshot();
  });

  it('l’aperçu compte les annonces de la semaine retenues avec un kilométrage plus large', async () => {
    // Given
    const { app, session } = await signedIn();

    // When
    const response = await app.request({ method: 'POST', url: '/api/settings/preview', payload: { maxKm: 150000 }, session });

    // Then
    const { status, body } = contract(response);
    expect({ status, body }).toMatchSnapshot();
  });

  it('l’aperçu de réglages sans ville renvoie l’erreur sans rien compter', async () => {
    // Given
    const { app, session } = await signedIn();

    // When
    const response = await app.request({
      method: 'POST',
      url: '/api/settings/preview',
      payload: { zone: { city: '', postalCode: '', lat: null, lon: null, radiusKm: 100 } },
      session,
    });

    // Then
    const { status, body } = contract(response);
    expect({ status, body }).toMatchSnapshot();
  });
});

describe('gabarits de message', () => {
  it('l’aperçu par défaut montre le premier gabarit des allemandes sur une Porsche d’exemple', async () => {
    // Given
    const { app, session } = await signedIn();

    // When
    const response = await app.request({ method: 'POST', url: '/api/templates/preview', payload: {}, session });

    // Then
    const { status, body } = contract(response);
    expect({ status, body }).toMatchSnapshot();
  });

  it('l’aperçu d’un texte saisi pour les italiennes signale le tiret long et retire la phrase au téléphone vide', async () => {
    // Given
    const { app, session } = await signedIn();

    // When
    const response = await app.request({
      method: 'POST',
      url: '/api/templates/preview',
      payload: {
        family: 'italiennes',
        text: 'Bonjour, votre {modele} de {annee} m’intéresse — je suis à {distance} km de chez vous. Appelez-moi au {telephone}, je n’insisterai pas.',
      },
      session,
    });

    // Then
    const { status, body } = contract(response);
    expect({ status, body }).toMatchSnapshot();
  });

  it('l’aperçu du gabarit sur une annonce réelle reprend la Porsche reçue', async () => {
    // Given
    const { app, session } = await signedIn();
    const vehicleId = app.vehicleIdOf(...PORSCHE_911_PRICE_DROP);

    // When
    const response = await app.request({ method: 'POST', url: '/api/templates/preview', payload: { vehicleId }, session });

    // Then
    const { status, body } = contract(response);
    expect({ status, body }).toMatchSnapshot();
  });
});

describe('sites et boîte mail', () => {
  it('l’écran Sites montre la boîte, les alertes des sites et le résumé tronqué de La Centrale', async () => {
    // Given
    const { app, session } = await signedIn();

    // When
    const response = await app.request({ method: 'GET', url: '/api/sources', session });

    // Then
    const { status, body } = contract(response);
    expect({ status, body }).toMatchSnapshot();
  });

  it('tester la boîte sans adresse ni mot de passe d’application', async () => {
    // Given
    const { app, session } = await signedIn();

    // When
    const response = await app.request({ method: 'POST', url: '/api/sources/imap/test', payload: {}, session });

    // Then
    const { status, body } = contract(response);
    expect({ status, body }).toMatchSnapshot();
  });

  it('tester une boîte dont le serveur refuse la connexion, avec le mot de passe enregistré renvoyé masqué', async () => {
    // Given
    const { app, session } = await signedIn();
    const unreachable = { ...IMAP_ACCOUNT, host: '127.0.0.1', port: 1 };
    await app.request({ method: 'PUT', url: '/api/settings', payload: { imap: { ...unreachable, pass: 'abcd efgh ijkl mnop' } }, session });

    // When
    const response = await app.request({
      method: 'POST',
      url: '/api/sources/imap/test',
      payload: { ...unreachable, pass: '••••••••' },
      session,
    });

    // Then
    const { status, body } = contract(response);
    expect({ status, body }).toMatchSnapshot();
  });

  it('tester une page de résultats sans adresse', async () => {
    // Given
    const { app, session } = await signedIn();

    // When
    const response = await app.request({ method: 'POST', url: '/api/sources/http/test', payload: { url: '   ' }, session });

    // Then
    const { status, body } = contract(response);
    expect({ status, body }).toMatchSnapshot();
  });

  it('tester une page de résultats dont l’adresse est invalide', async () => {
    // Given
    const { app, session } = await signedIn();

    // When
    const response = await app.request({
      method: 'POST',
      url: '/api/sources/http/test',
      payload: { url: 'leboncoin voitures bordeaux' },
      session,
    });

    // Then
    const { status, body } = contract(response);
    expect({ status, body }).toMatchSnapshot();
  });

  it('relever maintenant sans boîte configurée ni site lu directement', async () => {
    // Given
    const { app, session } = await signedIn();

    // When
    const response = await app.request({ method: 'POST', url: '/api/sources/check-now', session });

    // Then
    const { status, body } = contract(response);
    expect({ status, body }).toMatchSnapshot();
  });

  it('relire toute la boîte sans boîte configurée', async () => {
    // Given
    const { app, session } = await signedIn();

    // When
    const response = await app.request({ method: 'POST', url: '/api/sources/reread', session });

    // Then
    const { status, body } = contract(response);
    expect({ status, body }).toMatchSnapshot();
  });

  it('après une relecture sans boîte configurée, l’écran Sites a oublié les emails déjà lus', async () => {
    // Given
    const { app, session } = await signedIn();
    await app.request({ method: 'POST', url: '/api/sources/reread', session });

    // When
    const response = await app.request({ method: 'GET', url: '/api/sources', session });

    // Then
    const { status, body } = contract(response);
    expect({ status, body }).toMatchSnapshot();
  });

  it('la maintenance relit noms, familles et verdicts de toutes les annonces', async () => {
    // Given
    const { app, session } = await signedIn();

    // When
    const response = await app.request({ method: 'POST', url: '/api/maintenance/repair', session });

    // Then
    const { status, body } = contract(response);
    expect({ status, body }).toMatchSnapshot();
  });
});

describe('import ponctuel', () => {
  it('le jeton d’import est remis à l’application connectée', async () => {
    // Given
    const { app, session } = await signedIn();

    // When
    const response = await app.request({ method: 'GET', url: '/api/import/token', session });

    // Then
    const { status, body } = contract(response);
    expect({ status, body }).toMatchSnapshot();
  });

  it('le jeton d’import reste le même d’une demande à l’autre', async () => {
    // Given
    const { app, session } = await signedIn();
    const first = textField((await app.request({ method: 'GET', url: '/api/import/token', session })).body, 'token');

    // When
    const second = textField((await app.request({ method: 'GET', url: '/api/import/token', session })).body, 'token');

    // Then
    expect(second).toBe(first);
  });

  it('un import venu d’une autre page avant que l’application ait créé son jeton est refusé', async () => {
    // Given
    const { app } = await signedIn();

    // When
    const response = await app.request({
      method: 'POST',
      url: '/api/import',
      contentType: 'text/plain;charset=UTF-8',
      payload: JSON.stringify({
        token: '0123456789abcdef0123456789abcdef0123456789abcdef',
        listings: [{ site: 'leboncoin', url: 'https://www.leboncoin.fr/ad/voitures/2811012345', title: 'Porsche Cayman GT4' }],
      }),
    });

    // Then
    const { status, body } = contract(response);
    expect({ status, body }).toMatchSnapshot();
  });

  it('un import JSON sans session est refusé', async () => {
    // Given
    const { app } = await signedIn();

    // When
    const response = await app.request({
      method: 'POST',
      url: '/api/import',
      payload: { listings: [{ site: 'leboncoin', url: 'https://www.leboncoin.fr/ad/voitures/2811012345', title: 'Porsche Cayman GT4' }] },
    });

    // Then
    const { status, body } = contract(response);
    expect({ status, body }).toMatchSnapshot();
  });

  it('l’application importe une recherche lue à la main : une annonce nouvelle et une déjà connue', async () => {
    // Given
    const { app, session } = await signedIn();

    // When
    const response = await app.request({
      method: 'POST',
      url: '/api/import',
      payload: {
        listings: [
          {
            site: 'leboncoin',
            url: 'https://www.leboncoin.fr/ad/voitures/2811012345',
            title: 'Porsche Cayman GT4 3.8 385ch',
            price: 89900,
            km: 23000,
            year: 2016,
            city: 'Mérignac',
            postalCode: '33700',
            sellerType: 'particulier',
            publishedAt: '2026-10-12T18:30:00+02:00',
          },
          {
            site: 'leboncoin',
            externalId: '2811005678',
            url: 'https://www.leboncoin.fr/ad/voitures/2811005678',
            title: 'Ford Mustang GT 5.0 V8 Fastback',
            price: 42000,
          },
        ],
      },
      session,
    });

    // Then
    const { status, body } = contract(response);
    expect({ status, body }).toMatchSnapshot();
  });

  it('la page d’un autre site importe ses annonces avec le bon jeton, sans session', async () => {
    // Given
    const { app, session } = await signedIn();
    const token = textField((await app.request({ method: 'GET', url: '/api/import/token', session })).body, 'token');

    // When
    const response = await app.request({
      method: 'POST',
      url: '/api/import',
      contentType: 'text/plain;charset=UTF-8',
      payload: JSON.stringify({
        token,
        listings: [
          {
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
          },
        ],
      }),
    });

    // Then
    const { status, body } = contract(response);
    expect({ status, body }).toMatchSnapshot();
  });

  it('un import venu d’une autre page avec un jeton faux est refusé', async () => {
    // Given
    const { app, session } = await signedIn();
    await app.request({ method: 'GET', url: '/api/import/token', session });

    // When
    const response = await app.request({
      method: 'POST',
      url: '/api/import',
      contentType: 'text/plain;charset=UTF-8',
      payload: JSON.stringify({
        token: '0123456789abcdef0123456789abcdef0123456789abcdef',
        listings: [{ site: 'leboncoin', url: 'https://www.leboncoin.fr/ad/voitures/2811012345', title: 'Porsche Cayman GT4' }],
      }),
    });

    // Then
    const { status, body } = contract(response);
    expect({ status, body }).toMatchSnapshot();
  });

  it('un import sans annonce est refusé', async () => {
    // Given
    const { app, session } = await signedIn();

    // When
    const response = await app.request({ method: 'POST', url: '/api/import', payload: { listings: [] }, session });

    // Then
    const { status, body } = contract(response);
    expect({ status, body }).toMatchSnapshot();
  });

  it('les annonces incomplètes d’un import sont comptées à part', async () => {
    // Given
    const { app, session } = await signedIn();

    // When
    const response = await app.request({
      method: 'POST',
      url: '/api/import',
      payload: {
        listings: [
          { url: 'https://www.leboncoin.fr/ad/voitures/2811012346', title: 'Audi RS4 Avant 2.9 V6 450ch' },
          { site: 'leboncoin', url: 'javascript:void(0)', title: 'Audi RS4 Avant 2.9 V6 450ch' },
          { site: 'leboncoin', url: 'https://www.leboncoin.fr/ad/voitures/2811012347', title: '   ' },
        ],
      },
      session,
    });

    // Then
    const { status, body } = contract(response);
    expect({ status, body }).toMatchSnapshot();
  });

  it('la date de mise en ligne lue sur l’annonce complète une annonce connue', async () => {
    // Given
    const { app, session } = await signedIn();

    // When
    const response = await app.request({
      method: 'POST',
      url: '/api/import/dates',
      payload: { items: [{ site: 'leboncoin', externalId: '2811001234', publishedAt: '2026-10-11T08:15:00+02:00' }] },
      session,
    });

    // Then
    const { status, body } = contract(response);
    expect({ status, body }).toMatchSnapshot();
  });

  it('la date de mise en ligne lue sur l’annonce de la Mustang la range après les annonces reçues aujourd’hui', async () => {
    // Given
    const { app, session } = await signedIn();
    const mustang = app.vehicleIdOf(...FORD_MUSTANG);

    // When
    await app.request({
      method: 'POST',
      url: '/api/import/dates',
      payload: { items: [{ site: 'leboncoin', externalId: '2811005678', publishedAt: '2026-10-11T08:15:00+02:00' }] },
      session,
    });

    // Then
    const list = await app.request({ method: 'GET', url: '/api/vehicles', session });
    const sheet = await app.request({ method: 'GET', url: `/api/vehicles/${mustang}`, session });
    expect({ list: datesOf(list.body), sheet: contract(sheet) }).toMatchSnapshot();
  });

  it('des dates venues d’une autre page avec le bon jeton sont enregistrées', async () => {
    // Given
    const { app, session } = await signedIn();
    const token = textField((await app.request({ method: 'GET', url: '/api/import/token', session })).body, 'token');

    // When
    const response = await app.request({
      method: 'POST',
      url: '/api/import/dates',
      contentType: 'text/plain;charset=UTF-8',
      payload: JSON.stringify({ token, items: [{ site: 'leboncoin', externalId: '2811001234', publishedAt: '2026-10-11' }] }),
    });

    // Then
    const { status, body } = contract(response);
    expect({ status, body }).toMatchSnapshot();
  });

  it('une date pour une annonce inconnue est comptée à part', async () => {
    // Given
    const { app, session } = await signedIn();

    // When
    const response = await app.request({
      method: 'POST',
      url: '/api/import/dates',
      payload: { items: [{ site: 'leboncoin', externalId: '2899999999', publishedAt: '2026-10-11T08:15:00+02:00' }] },
      session,
    });

    // Then
    const { status, body } = contract(response);
    expect({ status, body }).toMatchSnapshot();
  });

  it('une date de mise en ligne dans le futur est refusée', async () => {
    // Given
    const { app, session } = await signedIn();

    // When
    const response = await app.request({
      method: 'POST',
      url: '/api/import/dates',
      payload: { items: [{ site: 'leboncoin', externalId: '2811005678', publishedAt: '2027-03-01T09:00:00+01:00' }] },
      session,
    });

    // Then
    const { status, body } = contract(response);
    expect({ status, body }).toMatchSnapshot();
  });

  it('des dates venues d’une autre page avec un jeton faux sont refusées', async () => {
    // Given
    const { app, session } = await signedIn();
    await app.request({ method: 'GET', url: '/api/import/token', session });

    // When
    const response = await app.request({
      method: 'POST',
      url: '/api/import/dates',
      contentType: 'text/plain;charset=UTF-8',
      payload: JSON.stringify({
        token: 'jeton-recopie-a-la-main',
        items: [{ site: 'leboncoin', externalId: '2811001234', publishedAt: '2026-10-11' }],
      }),
    });

    // Then
    const { status, body } = contract(response);
    expect({ status, body }).toMatchSnapshot();
  });

  it('un envoi de dates sans aucune date est refusé', async () => {
    // Given
    const { app, session } = await signedIn();

    // When
    const response = await app.request({ method: 'POST', url: '/api/import/dates', payload: { items: [] }, session });

    // Then
    const { status, body } = contract(response);
    expect({ status, body }).toMatchSnapshot();
  });
});

describe('notifications', () => {
  it('la clé publique des notifications est remise à l’application', async () => {
    // Given
    const { app, session } = await signedIn();

    // When
    const response = await app.request({ method: 'GET', url: '/api/push/key', session });

    // Then
    const { status, body } = contract(response);
    expect({ status, body }).toMatchSnapshot();
  });

  it('un abonnement sans adresse d’envoi est refusé', async () => {
    // Given
    const { app, session } = await signedIn();

    // When
    const response = await app.request({ method: 'POST', url: '/api/push/subscribe', payload: { subscription: { keys: {} } }, session });

    // Then
    const { status, body } = contract(response);
    expect({ status, body }).toMatchSnapshot();
  });

  it('le téléphone s’abonne aux notifications', async () => {
    // Given
    const { app, session } = await signedIn();

    // When
    const response = await app.request({
      method: 'POST',
      url: '/api/push/subscribe',
      payload: {
        subscription: {
          endpoint: 'https://fcm.googleapis.com/fcm/send/abonnement-de-test',
          keys: { p256dh: 'cle-p256dh-de-test', auth: 'secret-auth-de-test' },
        },
      },
      session,
    });

    // Then
    const { status, body } = contract(response);
    expect({ status, body }).toMatchSnapshot();
  });

  it('le téléphone se désabonne des notifications', async () => {
    // Given
    const { app, session } = await signedIn();
    const endpoint = 'https://fcm.googleapis.com/fcm/send/abonnement-de-test';
    await app.request({ method: 'POST', url: '/api/push/subscribe', payload: { subscription: { endpoint } }, session });

    // When
    const response = await app.request({ method: 'POST', url: '/api/push/unsubscribe', payload: { endpoint }, session });

    // Then
    const { status, body } = contract(response);
    expect({ status, body }).toMatchSnapshot();
  });

  it('tester les notifications sans aucun appareil abonné', async () => {
    // Given
    const { app, session } = await signedIn();

    // When
    const response = await app.request({ method: 'POST', url: '/api/push/test', session });

    // Then
    const { status, body } = contract(response);
    expect({ status, body }).toMatchSnapshot();
  });

  it('tester Telegram sans jeton de bot ni conversation', async () => {
    // Given
    const { app, session } = await signedIn();

    // When
    const response = await app.request({ method: 'POST', url: '/api/telegram/test', payload: {}, session });

    // Then
    const { status, body } = contract(response);
    expect({ status, body }).toMatchSnapshot();
  });
});

describe('application web', () => {
  it('l’adresse racine sert la page de l’application', async () => {
    // Given
    const app = await freshApp();

    // When
    const response = await app.request({ method: 'GET', url: '/' });

    // Then
    const html = typeof response.body === 'string' ? response.body : '';
    const page = {
      contentType: response.contentType,
      cacheControl: response.cacheControl,
      title: /<title>([^<]*)<\/title>/.exec(html)?.[1],
    };
    expect({ status: response.status, body: page }).toMatchSnapshot();
  });

  it('une adresse d’écran inconnue sert aussi la page de l’application', async () => {
    // Given
    const app = await freshApp();

    // When
    const response = await app.request({ method: 'GET', url: '/annonce/12' });

    // Then
    const html = typeof response.body === 'string' ? response.body : '';
    const page = {
      contentType: response.contentType,
      cacheControl: response.cacheControl,
      title: /<title>([^<]*)<\/title>/.exec(html)?.[1],
    };
    expect({ status: response.status, body: page }).toMatchSnapshot();
  });

  it('les icônes de l’application sont servies avec un cache d’une journée', async () => {
    // Given
    const app = await freshApp();

    // When
    const response = await app.request({ method: 'GET', url: '/icons/icon-192.png' });

    // Then
    expect({ status: response.status, contentType: response.contentType, cacheControl: response.cacheControl }).toMatchSnapshot();
  });
});
