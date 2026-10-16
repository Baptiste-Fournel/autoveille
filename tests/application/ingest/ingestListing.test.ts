import { describe, expect, it } from 'vitest';
import { ingestListing } from '../../../src/application/ingest/ingestListing.js';
import { vehicleMessage } from '../../../src/domain/messaging/vehicleMessage.js';
import { describeRejection } from '../../../src/domain/presentation/reasons.js';
import { defaultSettings } from '../../../src/domain/settings/defaults.js';
import type { Vehicle } from '../../../src/domain/vehicle/types.js';
import { FAKE_NOW } from '../../fakes/fakeClock.js';
import { DEALER_PHONE, type IngestWorld, ingest, ingestFromOlderAdsEmail, ingestWorld, PUBLIC_ADDRESS } from '../../support/ingestWorld.js';
import { LEBONCOIN_911_TITLE, leboncoinListing } from '../../support/knownVehicle.js';
import { withGarageTelegram } from '../../support/telegramSettings.js';

const porsche911 = leboncoinListing(LEBONCOIN_911_TITLE);

const stored = (world: IngestWorld, id: number): Vehicle => {
  const vehicle = world.vehicles.vehicle(id);
  if (vehicle === undefined) {
    throw new Error(`aucune voiture ${id}`);
  }
  return vehicle;
};

const pushedTitles = (world: IngestWorld): readonly string[] => world.channel.pushes().map((sent) => sent.notification.title);

const historyOf = (world: IngestWorld, id: number): readonly (readonly [string, string | null, string])[] =>
  world.vehicles.events(id).map((event) => [event.type, event.detail, event.at]);

describe('ingestion d’une annonce', () => {
  it('une 911 de Pessac arrive : retenue, à moins de 15 km de Bordeaux, et notifiée avec son message', async () => {
    // Given
    const world = ingestWorld();

    // When
    const outcome = await ingest(world, porsche911);

    // Then
    expect(outcome.kind).toBe('created');
    const vehicle = stored(world, 1);
    expect(vehicle.matched).toBe(true);
    expect(vehicle.distanceKm).toBeGreaterThan(0);
    expect(vehicle.distanceKm).toBeLessThan(15);
    expect(world.channel.pushes()).toEqual([
      {
        endpoint: DEALER_PHONE.endpoint,
        notification: expect.objectContaining({ title: 'Nouvelle annonce : Porsche 911 Carrera S', url: `${PUBLIC_ADDRESS}/#/annonce/1` }),
      },
    ]);
    expect(vehicle.notifiedAt).toBe(FAKE_NOW);
    expect(vehicleMessage(vehicle, world.vehicles.listingsOf(1)[0], world.settings.load())).toContain('Porsche 911 Carrera S');
    expect(historyOf(world, 1)).toEqual([['nouveau', 'Leboncoin', FAKE_NOW]]);
  });

  it('une Clio 1.2 arrive : enregistrée parmi les écartées (ni supercar ni collection), sans notification', async () => {
    // Given
    const world = ingestWorld();

    // When
    const outcome = await ingest(world, leboncoinListing('Renault Clio 1.2 2016 60 000 km 7 500 €'));

    // Then
    expect(outcome).toMatchObject({ kind: 'created', verdict: { pass: false } });
    expect(world.channel.pushes()).toHaveLength(0);
    const [reason] = stored(world, 1).rejections;
    expect(reason === undefined ? '' : describeRejection(reason)).toMatch(/ni supercar/);
    expect(stored(world, 1).notifiedAt).toBeNull();
  });

  it('baisse de prix sur une 911 à traiter : « Prix baissé » notifié une fois ; une hausse, ou une baisse sur une annonce ignorée, ne notifie pas', async () => {
    // Given
    const world = ingestWorld();
    await ingest(world, porsche911);

    // When
    const outcome = await ingest(world, { ...porsche911, price: 84900 });

    // Then
    expect(outcome).toMatchObject({ kind: 'priceChanged', from: 89900, to: 84900 });
    expect(stored(world, 1).priceDropped).toBe(true);
    expect(world.vehicles.priceHistory(1)).toHaveLength(2);
    expect(stored(world, 1).status).toBe('nouveau');
    expect(pushedTitles(world)).toEqual(['Nouvelle annonce : Porsche 911 Carrera S', 'Prix baissé : Porsche 911 Carrera S']);

    // When
    await ingest(world, { ...porsche911, price: 86900 });
    world.vehicles.applyVehicleUpdate(1, { status: 'ignore' });
    await ingest(world, { ...porsche911, price: 80000 });

    // Then
    expect(pushedTitles(world).filter((title) => title.startsWith('Prix baissé'))).toHaveLength(1);
    expect(historyOf(world, 1)).toEqual([
      ['prix_baisse', '86900 → 80000', FAKE_NOW],
      ['prix_hausse', '84900 → 86900', FAKE_NOW],
      ['prix_baisse', '89900 → 84900', FAKE_NOW],
      ['nouveau', 'Leboncoin', FAKE_NOW],
    ]);
  });

  it('un email La Centrale de baisses de prix : la 911 connue prend son nouveau prix, la BMW Série 2 inconnue n’est ni enregistrée ni notifiée', async () => {
    // Given
    const world = ingestWorld();
    await ingest(world, porsche911);
    const unknownBmw = {
      ...porsche911,
      site: 'lacentrale',
      siteLabel: 'La Centrale',
      externalId: '69115740011',
      url: 'https://www.lacentrale.fr/auto-occasion-annonce-69115740011.html',
      title: 'BMW SERIE 2',
      price: 62900,
      km: 45000,
      year: 2019,
    };

    // When
    const known = await ingestFromOlderAdsEmail(world, { ...porsche911, price: 84900 });
    const unknown = await ingestFromOlderAdsEmail(world, unknownBmw);

    // Then
    expect(known).toMatchObject({ kind: 'priceChanged', from: 89900, to: 84900 });
    expect(unknown).toEqual({ kind: 'leftAside' });
    expect(world.vehicles.allVehicles()).toHaveLength(1);
    expect(world.vehicles.findListing('lacentrale', '69115740011')).toBeUndefined();
    expect(pushedTitles(world)).toEqual(['Nouvelle annonce : Porsche 911 Carrera S', 'Prix baissé : Porsche 911 Carrera S']);
  });

  it('une 911 contactée, republiée sous un nouvel id sur Leboncoin, reste la même voiture, contactée, avec l’étiquette « Republiée »', async () => {
    // Given
    const world = ingestWorld();
    await ingest(world, porsche911);
    world.vehicles.applyVehicleUpdate(1, { status: 'contacte' });

    // When
    const outcome = await ingest(world, {
      ...porsche911,
      externalId: '2811009876',
      url: 'https://www.leboncoin.fr/ad/voitures/2811009876',
    });

    // Then
    expect(outcome).toMatchObject({ kind: 'attachedToVehicle', attachment: 'repost', vehicleId: 1 });
    expect(stored(world, 1).status).toBe('contacte');
    expect(stored(world, 1).reposted).toBe(true);
    expect(world.vehicles.listingsOf(1)).toHaveLength(2);
    expect(world.vehicles.priceHistory(2)).toEqual([{ price: 89900, seenAt: FAKE_NOW }]);
    expect(historyOf(world, 1)).toEqual([
      ['republiee', 'Leboncoin https://www.leboncoin.fr/ad/voitures/2811009876', FAKE_NOW],
      ['nouveau', 'Leboncoin', FAKE_NOW],
    ]);
    expect(world.channel.pushes()).toHaveLength(1);
  });

  it('la même 911 vue ensuite sur La Centrale est rattachée à la voiture de Leboncoin, sans étiquette « Republiée »', async () => {
    // Given
    const world = ingestWorld();
    await ingest(world, porsche911);

    // When
    const outcome = await ingest(world, {
      ...porsche911,
      site: 'lacentrale',
      siteLabel: 'La Centrale',
      externalId: '69115730042',
      url: 'https://www.lacentrale.fr/auto-occasion-annonce-69115730042.html',
      title: 'PORSCHE 911 CARRERA S PDK',
      year: 2015,
      km: 43000,
      price: 88500,
    });

    // Then
    expect(outcome).toMatchObject({ kind: 'attachedToVehicle', attachment: 'otherSite', vehicleId: 1 });
    expect(stored(world, 1).reposted).toBe(false);
    expect(world.vehicles.priceHistory(2)).toEqual([{ price: 88500, seenAt: FAKE_NOW }]);
    expect(historyOf(world, 1)).toEqual([
      ['autre_site', 'La Centrale https://www.lacentrale.fr/auto-occasion-annonce-69115730042.html', FAKE_NOW],
      ['nouveau', 'Leboncoin', FAKE_NOW],
    ]);
  });

  it('une 911 lue d’abord sans prix (retenue grâce au mot-clé « 911 ») puis relue avec prix, photo et texte est complétée, sans événement de prix', async () => {
    // Given
    const world = ingestWorld();
    const firstReading = { ...porsche911, title: 'Porsche 911 Carrera S', km: 42000, year: 2015 };
    const first = await ingest(world, firstReading);
    const unpriced = stored(world, first.vehicleId);

    // When
    const again = await ingest(world, {
      ...firstReading,
      price: 89900,
      description: 'Première main, carnet d’entretien Porsche à jour, jamais accidentée.',
      imageUrl: 'https://img.leboncoin.fr/api/v1/lbcpb1/images/3f/9a/12/3f9a12c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0.jpg?rule=ad-large',
    });

    // Then
    expect(first.kind).toBe('created');
    expect(unpriced.price).toBeNull();
    expect(unpriced.matched).toBe(true);
    expect(again.kind).toBe('seenAgain');
    expect(stored(world, first.vehicleId).price).toBe(89900);
    expect(world.vehicles.listingsOf(first.vehicleId)[0]).toMatchObject({
      price: 89900,
      imageUrl: 'https://img.leboncoin.fr/api/v1/lbcpb1/images/3f/9a/12/3f9a12c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0.jpg?rule=ad-large',
      description: 'Première main, carnet d’entretien Porsche à jour, jamais accidentée.',
    });
    expect(world.vehicles.events(first.vehicleId).some((event) => event.type.startsWith('prix_'))).toBe(false);
  });

  it('la 911 relue puis republiée n’est géocodée qu’à sa première arrivée', async () => {
    // Given
    const world = ingestWorld();
    await ingest(world, porsche911);

    // When
    await ingest(world, porsche911);
    await ingest(world, { ...porsche911, externalId: '2811009876', url: 'https://www.leboncoin.fr/ad/voitures/2811009876' });

    // Then
    expect(world.geocoder.queries()).toEqual([{ city: 'Pessac', postalCode: '33600' }]);
  });

  it('la ville de la concession, saisie « Bordeau », est introuvable : la 911 est enregistrée sans distance, et sa ville n’est pas cherchée', async () => {
    // Given
    const defaults = defaultSettings();
    const world = ingestWorld({
      settings: { ...defaults, zone: { ...defaults.zone, city: 'Bordeau', postalCode: '', lat: null, lon: null } },
    });

    // When
    await ingest(world, porsche911);

    // Then
    expect(stored(world, 1)).toMatchObject({ lat: null, lon: null, distanceKm: null, matched: true });
    expect(world.geocoder.queries()).toEqual([]);
  });
});

describe('ingestion d’une annonce : une notification qui échoue', () => {
  it('le bot Telegram de la concession a été révoqué : le téléphone reçoit la 911, qui est marquée notifiée, et l’échec Telegram est noté dans son historique', async () => {
    // Given
    const world = ingestWorld({
      settings: withGarageTelegram(),
      channel: { telegramFailure: new Error('Telegram 401: {"ok":false,"error_code":401,"description":"Unauthorized"}') },
    });

    // When
    const outcome = await ingest(world, porsche911);

    // Then
    expect(outcome).toMatchObject({ kind: 'created', verdict: { pass: true } });
    expect(stored(world, 1).notifiedAt).toBe(FAKE_NOW);
    expect(pushedTitles(world)).toEqual(['Nouvelle annonce : Porsche 911 Carrera S']);
    expect(world.vehicles.events(1)).toContainEqual(
      expect.objectContaining({
        type: 'notification_echec',
        detail: 'Error: Telegram 401: {"ok":false,"error_code":401,"description":"Unauthorized"}',
        at: FAKE_NOW,
      }),
    );
    expect(world.vehicles.listingsOf(1)).toHaveLength(1);
  });

  it('la 911 importée à la main baisse à 84 900 € mais le service push répond en erreur : l’échec est noté et le nouveau prix est bien enregistré', async () => {
    // Given
    const world = ingestWorld({
      channel: { failingEndpoints: { [DEALER_PHONE.endpoint]: new Error('Received unexpected response code') } },
    });
    await ingestListing(world.dependencies, { listing: porsche911, settings: world.settings.load(), notify: false, aboutOlderAds: false });

    // When
    const outcome = await ingest(world, { ...porsche911, price: 84900 });

    // Then
    expect(outcome).toMatchObject({ kind: 'priceChanged', from: 89900, to: 84900 });
    expect(stored(world, 1).price).toBe(84900);
    expect(world.vehicles.events(1).map((event) => [event.type, event.detail])).toContainEqual([
      'notification_echec',
      'Error: Received unexpected response code',
    ]);
  });
});
