import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import Database from 'better-sqlite3';
import type { LightMyRequestResponse } from 'fastify';
import { describe, expect, it, onTestFinished } from 'vitest';
import { ingestListing } from '../../../src/application/ingest/ingestListing.js';
import type { RawListing } from '../../../src/domain/vehicle/types.js';
import { buildLegacyDatabase, LEGACY_PASSWORD } from '../../fixtures/db/buildLegacyDatabase.js';
import { SESSION_COOKIE } from '../../support/authentication.js';
import type { ComposedApplication } from '../../support/composedApplication.js';
import { runningApplication, signedInApplication } from '../../support/signedInApplication.js';

const FIRST_YEAR_OF_THE_911_SERIES = 1965;

const MERCEDES_C63_ON_LA_CENTRALE: RawListing = {
  site: 'lacentrale',
  siteLabel: 'La Centrale',
  externalId: '69112345678',
  url: 'https://www.lacentrale.fr/auto-occasion-annonce-69112345678.html',
  title: 'Mercedes-AMG C63 S Coupé',
  price: 64900,
  km: 45200,
  year: 2019,
  city: 'Libourne',
  postalCode: '33500',
  sellerType: 'particulier',
};

const MERCEDES_C63_ON_LEBONCOIN: RawListing = {
  site: 'leboncoin',
  siteLabel: 'Leboncoin',
  externalId: '2811004321',
  url: 'https://www.leboncoin.fr/ad/voitures/2811004321',
  title: 'Mercedes-AMG C63 S Coupé 510ch',
  price: 63900,
  km: 45300,
  year: 2019,
  city: 'Libourne',
  postalCode: '33500',
  sellerType: 'particulier',
  imageUrl: 'https://img.leboncoin.fr/api/v1/lbcpb1/images/c6/3s/c63s-coupe.jpg',
  description: 'Mercedes-AMG C63 S Coupé, carnet Mercedes, échappement Performance, jamais tournée sur circuit.',
};

const PORSCHE_911_4S: RawListing = {
  site: 'leboncoin',
  siteLabel: 'Leboncoin',
  externalId: '2811001234',
  url: 'https://www.leboncoin.fr/ad/voitures/2811001234',
  title: 'Porsche 911 Carrera 4S 3.0 450ch PDK',
  price: 112900,
  km: 42000,
  year: 2017,
  city: 'Mérignac',
  postalCode: '33700',
  sellerType: 'particulier',
};

const FORD_MUSTANG: RawListing = {
  site: 'leboncoin',
  siteLabel: 'Leboncoin',
  externalId: '2811005678',
  url: 'https://www.leboncoin.fr/ad/voitures/2811005678',
  title: 'Ford Mustang GT 5.0 V8 Fastback',
  price: 42000,
  km: 31000,
  year: 2018,
  city: 'Arcachon',
  postalCode: '33120',
  sellerType: 'particulier',
};

const BMW_M3_E46_128000_KM: RawListing = {
  site: 'leboncoin',
  siteLabel: 'Leboncoin',
  externalId: '2811009999',
  url: 'https://www.leboncoin.fr/ad/voitures/2811009999',
  title: 'BMW M3 E46 3.2 343ch',
  price: 34500,
  km: 128000,
  year: 2004,
  city: 'Bordeaux',
  postalCode: '33000',
  sellerType: 'particulier',
};

const AUDI_A3_NOT_SPECIAL: RawListing = {
  site: 'leboncoin',
  siteLabel: 'Leboncoin',
  externalId: '2811007777',
  url: 'https://www.leboncoin.fr/ad/voitures/2811007777',
  title: 'Audi A3 Sportback 2.0 TDI 150',
  price: 21500,
  km: 48000,
  year: 2019,
  city: 'Talence',
  postalCode: '33400',
  sellerType: 'particulier',
};

const PORSCHE_997_FROM_A_DEALER_IN_ANGOULEME: RawListing = {
  site: 'lacentrale',
  siteLabel: 'La Centrale',
  externalId: '69100000001',
  url: 'https://www.lacentrale.fr/auto-occasion-annonce-69100000001.html',
  title: 'Porsche 911 (997) Carrera S 3.8 355ch',
  price: 54900,
  km: 89000,
  year: 2006,
  city: 'Angoulême',
  postalCode: '16000',
  sellerType: 'pro',
};

const TOYOTA_GR_YARIS: RawListing = {
  site: 'leboncoin',
  siteLabel: 'Leboncoin',
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

const PORSCHE_944_SEEN_LAST_WEEK: RawListing = {
  site: 'leboncoin',
  siteLabel: 'Leboncoin',
  externalId: '2810004321',
  url: 'https://www.leboncoin.fr/ad/voitures/2810004321',
  title: 'Porsche 944 Turbo 2.5 220ch',
  price: 32900,
  km: 96000,
  year: 1986,
  city: 'Saint-Médard-en-Jalles',
  postalCode: '33160',
  sellerType: 'particulier',
};

const porsche911Of = (year: number): RawListing => ({
  site: 'leboncoin',
  siteLabel: 'Leboncoin',
  externalId: `2813${year}`,
  url: `https://www.leboncoin.fr/ad/voitures/2813${year}`,
  title: 'Porsche 911 Carrera',
  price: 89900,
  km: 42000,
  year,
  city: 'Pessac',
  postalCode: '33600',
  sellerType: 'particulier',
});

interface VehicleCardSeen {
  readonly id: number;
  readonly name: string;
}

interface VehiclePageSeen {
  readonly vehicles: readonly VehicleCardSeen[];
  readonly nextCursor: string | null;
}

function sessionOf(response: LightMyRequestResponse): { readonly cookie: string } {
  const cookie = response.cookies.find((candidate) => candidate.name === SESSION_COOKIE);
  if (cookie === undefined) throw new Error(`Aucun cookie de session (${response.statusCode})`);
  return { cookie: `${SESSION_COOKIE}=${cookie.value}` };
}

async function received(application: ComposedApplication, listing: RawListing): Promise<number> {
  const { ports } = application;
  const outcome = await ingestListing(ports, { listing, settings: ports.settings.load(), notify: false });
  return outcome.vehicleId;
}

async function get(
  application: ComposedApplication,
  url: string,
  headers: Readonly<Record<string, string>>,
): Promise<LightMyRequestResponse> {
  return application.server.inject({ method: 'GET', url, headers });
}

function pageOf(response: LightMyRequestResponse): VehiclePageSeen {
  return response.json<VehiclePageSeen>();
}

function idsOf(page: VehiclePageSeen): readonly number[] {
  return page.vehicles.map((vehicle) => vehicle.id);
}

describe('liste des annonces, page par page', () => {
  it('une semaine d’alertes larges : 55 Porsche 911 à traiter arrivent en deux pages, 50 puis 5, la seconde reprenant juste après la dernière carte de la première', async () => {
    // Given
    const { application, session } = await signedInApplication();
    for (let offset = 0; offset < 55; offset += 1) {
      await received(application, porsche911Of(FIRST_YEAR_OF_THE_911_SERIES + offset));
    }
    const everything = pageOf(await get(application, '/api/vehicles?limit=1000', session));

    // When
    const first = pageOf(await get(application, '/api/vehicles', session));
    const second = pageOf(await get(application, `/api/vehicles?cursor=${encodeURIComponent(first.nextCursor ?? '')}`, session));

    // Then
    expect(idsOf(first)).toHaveLength(50);
    expect(typeof first.nextCursor).toBe('string');
    expect(idsOf(second)).toHaveLength(5);
    expect(second.nextCursor).toBeNull();
    expect([...idsOf(first), ...idsOf(second)]).toEqual(idsOf(everything));
  });

  it('l’application d’avant la pagination demande une page de 1 000 annonces et reçoit les 55 à traiter d’un coup', async () => {
    // Given
    const { application, session } = await signedInApplication();
    for (let offset = 0; offset < 55; offset += 1) {
      await received(application, porsche911Of(FIRST_YEAR_OF_THE_911_SERIES + offset));
    }

    // When
    const response = await get(application, '/api/vehicles?status=nouveau&limit=1000', session);

    // Then
    expect(response.statusCode).toBe(200);
    expect(idsOf(pageOf(response))).toHaveLength(55);
    expect(pageOf(response).nextCursor).toBeNull();
  });

  it('une page de plus de 1 000 annonces est refusée', async () => {
    // Given
    const { application, session } = await signedInApplication();

    // When
    const response = await get(application, '/api/vehicles?limit=1001', session);

    // Then
    expect({ status: response.statusCode, body: response.json() }).toEqual({ status: 400, body: { error: 'Requête invalide.' } });
  });

  it('une page de 1e400 annonces, nombre que le serveur lirait comme l’infini, est refusée au lieu de faire échouer la base', async () => {
    // Given
    const { application, session } = await signedInApplication();

    // When
    const response = await get(application, '/api/vehicles?limit=1e400', session);

    // Then
    expect({ status: response.statusCode, body: response.json() }).toEqual({ status: 400, body: { error: 'Requête invalide.' } });
  });

  it('une page suivante demandée avec un curseur coupé en route est refusée avec une phrase en français', async () => {
    // Given
    const { application, session } = await signedInApplication();
    await received(application, PORSCHE_911_4S);
    await received(application, FORD_MUSTANG);
    const cursor = pageOf(await get(application, '/api/vehicles?limit=1', session)).nextCursor ?? '';

    // When
    const response = await get(application, `/api/vehicles?limit=1&cursor=${cursor.slice(0, -4)}`, session);

    // Then
    expect({ status: response.statusCode, body: response.json() }).toEqual({
      status: 400,
      body: { error: 'Curseur de pagination illisible : rechargez la liste.' },
    });
  });

  it('un numéro de page envoyé à la place du curseur est refusé', async () => {
    // Given
    const { application, session } = await signedInApplication();
    await received(application, PORSCHE_911_4S);

    // When
    const response = await get(application, '/api/vehicles?cursor=2', session);

    // Then
    expect({ status: response.statusCode, body: response.json() }).toEqual({
      status: 400,
      body: { error: 'Curseur de pagination illisible : rechargez la liste.' },
    });
  });
});

describe('annonces écartées, page par page', () => {
  it('toutes les écartées, marques non suivies comprises, se lisent page par page, avec les compteurs par raison de toute la quinzaine sur chaque page', async () => {
    // Given
    const { application, session } = await signedInApplication();
    for (const listing of [BMW_M3_E46_128000_KM, AUDI_A3_NOT_SPECIAL, PORSCHE_997_FROM_A_DEALER_IN_ANGOULEME, TOYOTA_GR_YARIS]) {
      await received(application, listing);
    }
    const kinds = { tous: 4, suivies: 3, loin: 1, km: 1, special: 1, pro: 1, marque: 1 };

    // When
    const first = await get(application, '/api/vehicles?status=ecartees&kind=tous&limit=2', session);
    const second = await get(
      application,
      `/api/vehicles?status=ecartees&kind=tous&limit=2&cursor=${encodeURIComponent(pageOf(first).nextCursor ?? '')}`,
      session,
    );

    // Then
    expect(first.json()).toMatchObject({ kinds, nextCursor: expect.any(String) });
    expect(second.json()).toMatchObject({ kinds, nextCursor: null });
    expect([...pageOf(first).vehicles, ...pageOf(second).vehicles].map((vehicle) => vehicle.name)).toEqual([
      'BMW M3 E46',
      'Audi A3 Sportback',
      'Porsche 911 (997) Carrera',
      'Toyota GR Yaris',
    ]);
  });

  it('chaque écartée dit en clair pourquoi elle a été écartée, et la BMW M3 pourquoi elle reste une voiture de collection', async () => {
    // Given
    const { application, session } = await signedInApplication();
    for (const listing of [BMW_M3_E46_128000_KM, PORSCHE_997_FROM_A_DEALER_IN_ANGOULEME, TOYOTA_GR_YARIS]) {
      await received(application, listing);
    }

    // When
    const response = await get(application, '/api/vehicles?status=ecartees&kind=tous', session);

    // Then
    expect(response.json()).toMatchObject({
      vehicles: [
        { name: 'BMW M3 E46', reasons: ['128 000 km, au-dessus de 100 000 km'], specialReason: 'modèle « M3 »' },
        { name: 'Porsche 911 (997) Carrera', reasons: ['vendeur professionnel', 'à 107 km, hors du rayon de 100 km'], distanceKm: 107 },
        { name: 'Toyota GR Yaris', reasons: ['marque Toyota hors des familles suivies'], familyLabel: 'Autres' },
      ],
    });
  });
});

describe('liste des annonces retenues', () => {
  it('toutes les annonces retenues des trois derniers jours laissent de côté la 944 vue la semaine dernière', async () => {
    // Given
    const { application, session } = await signedInApplication();
    await received(application, PORSCHE_944_SEEN_LAST_WEEK);
    application.clock.advanceBy(7 * 86_400_000);
    await received(application, FORD_MUSTANG);

    // When
    const response = await get(application, '/api/vehicles?status=tous&days=3', session);

    // Then
    expect(pageOf(response).vehicles.map((vehicle) => vehicle.name)).toEqual(['Ford Mustang GT']);
  });

  it('une fenêtre de jours tapée dans l’adresse avec trop de zéros est refusée en français, au lieu de faire échouer le serveur', async () => {
    // Given
    const { application, session } = await signedInApplication();
    await received(application, FORD_MUSTANG);

    // When
    const response = await get(application, '/api/vehicles?status=tous&days=100000000000', session);

    // Then
    expect({ status: response.statusCode, body: response.json() }).toEqual({ status: 400, body: { error: 'Requête invalide.' } });
  });

  it('une fenêtre de 1e400 jours, nombre que le serveur lirait comme l’infini, est refusée au lieu de faire échouer le serveur', async () => {
    // Given
    const { application, session } = await signedInApplication();
    await received(application, FORD_MUSTANG);

    // When
    const response = await get(application, '/api/vehicles?status=tous&days=1e400', session);

    // Then
    expect({ status: response.statusCode, body: response.json() }).toEqual({ status: 400, body: { error: 'Requête invalide.' } });
  });
});

describe('carte et fiche d’une annonce', () => {
  it('une Mercedes-AMG C63 lue d’abord sur La Centrale sans photo, puis sur Leboncoin avec photo et texte : la carte garde le lien de La Centrale et montre la photo et le texte de Leboncoin', async () => {
    // Given
    const { application, session } = await signedInApplication();
    await received(application, MERCEDES_C63_ON_LA_CENTRALE);
    await received(application, MERCEDES_C63_ON_LEBONCOIN);

    // When
    const response = await get(application, '/api/vehicles', session);

    // Then
    expect(response.json()).toMatchObject({
      vehicles: [
        {
          name: 'Mercedes-Benz C63 S Coupé',
          title: 'Mercedes-AMG C63 S Coupé',
          url: MERCEDES_C63_ON_LA_CENTRALE.url,
          siteLabel: 'La Centrale',
          imageUrl: MERCEDES_C63_ON_LEBONCOIN.imageUrl,
          description: MERCEDES_C63_ON_LEBONCOIN.description,
        },
      ],
    });
  });

  it('la fiche d’une Porsche dont le prix a baissé donne l’historique de prix et les événements, que sa carte dans la liste ne donne pas', async () => {
    // Given
    const { application, session } = await signedInApplication();
    const id = await received(application, PORSCHE_911_4S);
    application.clock.advanceBy(3_600_000);
    await received(application, { ...PORSCHE_911_4S, price: 109900 });

    // When
    const sheet = await get(application, `/api/vehicles/${id}`, session);
    const list = await get(application, '/api/vehicles', session);

    // Then
    expect(sheet.json()).toMatchObject({
      name: 'Porsche 911 Carrera 4S',
      familyLabel: 'Allemandes',
      distanceKm: 5,
      specialReason: 'prix ≥ 40 000 €',
      price: 109900,
      priceDropped: true,
      listings: [
        {
          priceHistory: [
            { price: 112900, seen_at: '2026-10-15T08:30:00.000Z' },
            { price: 109900, seen_at: '2026-10-15T09:30:00.000Z' },
          ],
        },
      ],
      events: [
        { vehicle_id: id, type: 'prix_baisse', detail: '112900 → 109900', at: '2026-10-15T09:30:00.000Z' },
        { vehicle_id: id, type: 'nouveau', at: '2026-10-15T08:30:00.000Z' },
      ],
    });
    expect(list.json()).toMatchObject({ vehicles: [{ id, priceDropped: true, listings: [{ priceHistory: [] }], events: [] }] });
  });

  it('une voiture enregistrée par la première version, avant que la voiture retienne sa date de mise en ligne, prend la plus ancienne date de ses annonces', async () => {
    // Given
    const directory = mkdtempSync(join(tmpdir(), 'autoveille-v1-'));
    onTestFinished(() => rmSync(directory, { recursive: true, force: true }));
    const databaseFile = join(directory, 'autoveille.sqlite');
    buildLegacyDatabase(databaseFile);
    const v1 = new Database(databaseFile);
    v1.prepare("UPDATE vehicles SET published_at = NULL WHERE make = 'Mercedes-Benz' AND model = 'C63 S Coupé'").run();
    const mercedes = v1.prepare<[], { readonly id: number }>("SELECT id FROM vehicles WHERE model = 'C63 S Coupé'").get();
    v1.close();
    const application = await runningApplication({ databaseFile });
    const session = sessionOf(
      await application.server.inject({ method: 'POST', url: '/api/login', payload: { password: LEGACY_PASSWORD } }),
    );

    // When
    const response = await get(application, `/api/vehicles/${mercedes?.id}`, session);

    // Then
    expect(response.json()).toMatchObject({ name: 'Mercedes-Benz C63 S Coupé', publishedAt: '2026-09-16T06:40:12.000Z' });
  });

  it('une fiche demandée avec un identifiant qui n’est pas un numéro est introuvable', async () => {
    // Given
    const { application, session } = await signedInApplication();

    // When
    const response = await get(application, '/api/vehicles/abc', session);

    // Then
    expect({ status: response.statusCode, body: response.json() }).toEqual({ status: 404, body: { error: 'Annonce inconnue.' } });
  });
});

describe('suivi et suppression d’une annonce', () => {
  it('le concessionnaire marque la Mustang comme contactée : la réponse est sa fiche, avec la date du contact', async () => {
    // Given
    const { application, session } = await signedInApplication();
    const id = await received(application, FORD_MUSTANG);
    application.clock.advanceBy(600_000);

    // When
    const response = await application.server.inject({
      method: 'POST',
      url: `/api/vehicles/${id}`,
      payload: { status: 'contacte' },
      headers: session,
    });

    // Then
    expect(response.json()).toMatchObject({
      id,
      status: 'contacte',
      contactedAt: '2026-10-15T08:40:00.000Z',
      events: [{ type: 'statut_contacte' }, { type: 'nouveau' }],
    });
  });

  it('le concessionnaire note le rendez-vous et réécrit le message : la fiche montre la note et le message, marqué comme retouché', async () => {
    // Given
    const { application, session } = await signedInApplication();
    const id = await received(application, FORD_MUSTANG);
    const message = 'Bonjour, votre Mustang GT m’intéresse pour le showroom. Je peux passer la voir samedi ?';
    await application.server.inject({ method: 'POST', url: `/api/vehicles/${id}`, payload: { message }, headers: session });

    // When
    const response = await application.server.inject({
      method: 'POST',
      url: `/api/vehicles/${id}`,
      payload: { note: 'Rendez-vous samedi 10 h à Arcachon, carnet d’entretien à vérifier.' },
      headers: session,
    });

    // Then
    expect(response.json()).toMatchObject({
      message,
      messageEdited: true,
      note: 'Rendez-vous samedi 10 h à Arcachon, carnet d’entretien à vérifier.',
    });
  });

  it('modifier une annonce dont l’adresse ne porte pas un numéro est introuvable', async () => {
    // Given
    const { application, session } = await signedInApplication();

    // When
    const response = await application.server.inject({
      method: 'POST',
      url: '/api/vehicles/mustang',
      payload: { status: 'contacte' },
      headers: session,
    });

    // Then
    expect({ status: response.statusCode, body: response.json() }).toEqual({ status: 404, body: { error: 'Annonce inconnue.' } });
  });

  it('le concessionnaire supprime une Audi mal lue : elle n’est plus dans les écartées', async () => {
    // Given
    const { application, session } = await signedInApplication();
    const id = await received(application, AUDI_A3_NOT_SPECIAL);

    // When
    const response = await application.server.inject({ method: 'DELETE', url: `/api/vehicles/${id}`, headers: session });

    // Then
    expect({ status: response.statusCode, body: response.json() }).toEqual({ status: 200, body: { ok: true } });
    expect((await get(application, '/api/vehicles?status=ecartees', session)).json()).toMatchObject({ vehicles: [] });
  });
});

describe('étiquette de la liste (ETag)', () => {
  it('la liste redemandée sans changement répond 304, sans renvoyer les annonces', async () => {
    // Given
    const { application, session } = await signedInApplication();
    await received(application, PORSCHE_911_4S);
    const first = await get(application, '/api/vehicles', session);

    // When
    const again = await get(application, '/api/vehicles', { ...session, 'if-none-match': String(first.headers.etag) });

    // Then
    expect(first.headers.etag).toEqual(expect.any(String));
    expect(again.statusCode).toBe(304);
    expect(again.body).toBe('');
  });

  it('après le passage de la Mustang en « contactée » depuis la fiche, la liste « À traiter » a changé et revient en entier', async () => {
    // Given
    const { application, session } = await signedInApplication();
    await received(application, PORSCHE_911_4S);
    const mustang = await received(application, FORD_MUSTANG);
    const before = await get(application, '/api/vehicles', session);
    await application.server.inject({ method: 'POST', url: `/api/vehicles/${mustang}`, payload: { status: 'contacte' }, headers: session });

    // When
    const after = await get(application, '/api/vehicles', { ...session, 'if-none-match': String(before.headers.etag) });

    // Then
    expect(after.statusCode).toBe(200);
    expect(after.headers.etag).not.toBe(before.headers.etag);
    expect(pageOf(after).vehicles.map((vehicle) => vehicle.name)).toEqual(['Porsche 911 Carrera 4S']);
  });
});
