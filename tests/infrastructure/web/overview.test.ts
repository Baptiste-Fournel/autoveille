import type { LightMyRequestResponse } from 'fastify';
import { describe, expect, it } from 'vitest';
import { ingestListing } from '../../../src/application/ingest/ingestListing.js';
import type { RawListing } from '../../../src/domain/vehicle/types.js';
import type { ComposedApplication } from '../../support/composedApplication.js';
import { signedInApplication } from '../../support/signedInApplication.js';

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

async function received(application: ComposedApplication, listing: RawListing): Promise<void> {
  const { ports } = application;
  await ingestListing(ports, { listing, settings: ports.settings.load(), notify: false, aboutOlderAds: false });
}

async function overviewSeen(application: ComposedApplication, headers: Readonly<Record<string, string>>): Promise<LightMyRequestResponse> {
  return application.server.inject({ method: 'GET', url: '/api/overview', headers });
}

describe('accueil', () => {
  it('l’alerte La Centrale réglée sur 50 km et 80 000 km apparaît sur l’accueil en deux phrases précédées du nom du site', async () => {
    // Given
    const { application, session } = await signedInApplication();
    const settings = application.ports.settings.load();
    application.ports.settings.save({
      ...settings,
      alerts: {
        lacentrale: {
          site: 'lacentrale',
          criteria: '80 000 km max, 33000 (rayon de 50 km), particuliers',
          confirmedAt: '2026-10-12T17:42:05.000Z',
          radiusKm: 50,
          maxKm: 80000,
          postalCode: '33000',
          sellerType: 'particulier',
        },
      },
    });

    // When
    const response = await overviewSeen(application, session);

    // Then
    expect(response.json()).toMatchObject({
      alertIssues: [
        'La Centrale : L’alerte du site ne couvre que 50 km autour de la ville, vos réglages vont jusqu’à 100 km : les annonces entre les deux n’arriveront jamais.',
        'La Centrale : L’alerte du site s’arrête à 80 000 km au compteur, vos réglages acceptent jusqu’à 100 000 km.',
      ],
    });
  });

  it('l’accueil donne le dernier passage de chaque source sous les noms de colonnes d’origine, la réussite valant 1 et l’échec 0', async () => {
    // Given
    const { application, session } = await signedInApplication();
    application.ports.sourceRuns.record({
      source: 'http:k3v9q2xa',
      lastRunAt: '2026-10-15T07:00:00.000Z',
      ok: true,
      detail: '12 annonce(s) lue(s) (données structurées). 0 nouvelle(s) correspondant aux réglages.',
    });
    application.ports.sourceRuns.record({
      source: 'email',
      lastRunAt: '2026-10-15T08:00:00.000Z',
      ok: false,
      detail: '2 email(s) lu(s), 3 annonce(s), 2 nouvelle(s) correspondant aux réglages ; 1 erreur(s) : uid 41: Unexpected close',
    });

    // When
    const response = await overviewSeen(application, session);

    // Then
    expect(response.json()).toMatchObject({
      sources: [
        {
          source: 'http:k3v9q2xa',
          last_run_at: '2026-10-15T07:00:00.000Z',
          ok: 1,
          detail: '12 annonce(s) lue(s) (données structurées). 0 nouvelle(s) correspondant aux réglages.',
        },
        {
          source: 'email',
          last_run_at: '2026-10-15T08:00:00.000Z',
          ok: 0,
          detail: '2 email(s) lu(s), 3 annonce(s), 2 nouvelle(s) correspondant aux réglages ; 1 erreur(s) : uid 41: Unexpected close',
        },
      ],
    });
  });

  it('dès le premier démarrage, l’accueil remet la clé publique des notifications', async () => {
    // Given
    const { application, session } = await signedInApplication();

    // When
    const response = await overviewSeen(application, session);

    // Then
    expect(response.json()).toMatchObject({ pushKey: expect.stringMatching(/^B[A-Za-z0-9_-]{86}$/) });
  });
});

describe('étiquette de l’accueil (ETag)', () => {
  it('l’accueil redemandé sans changement répond 304, sans renvoyer le résumé', async () => {
    // Given
    const { application, session } = await signedInApplication();
    await received(application, PORSCHE_911_4S);
    const first = await overviewSeen(application, session);

    // When
    const again = await overviewSeen(application, { ...session, 'if-none-match': String(first.headers.etag) });

    // Then
    expect(first.headers.etag).toEqual(expect.any(String));
    expect(again.statusCode).toBe(304);
    expect(again.body).toBe('');
  });

  it('une Mustang arrivée depuis la dernière visite change l’étiquette de l’accueil, qui revient en entier', async () => {
    // Given
    const { application, session } = await signedInApplication();
    await received(application, PORSCHE_911_4S);
    const before = await overviewSeen(application, session);
    await received(application, FORD_MUSTANG);

    // When
    const after = await overviewSeen(application, { ...session, 'if-none-match': String(before.headers.etag) });

    // Then
    expect(after.statusCode).toBe(200);
    expect(after.headers.etag).not.toBe(before.headers.etag);
    expect(after.json()).toMatchObject({ counts: { nouveau: 2, today: 2 } });
  });
});
