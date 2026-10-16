import { describe, expect, it } from 'vitest';
import type { IngestDecision } from '../../../src/domain/ingest/decide.js';
import { UNKNOWN_LOCATION, type VehicleLocation } from '../../../src/domain/ingest/location.js';
import { fingerprint } from '../../../src/domain/vehicle/identity.js';
import type { Listing, RawListing, Vehicle } from '../../../src/domain/vehicle/types.js';
import { decide, NOW } from '../../support/ingestion.js';
import { FIRST_READ_AT, LEBONCOIN_911_TITLE, leboncoinListing as leboncoin, PESSAC } from '../../support/knownVehicle.js';

const LIBOURNE: VehicleLocation = { lat: 44.915, lon: -0.2436, distanceKm: 27.8 };
const MONTAUBAN: VehicleLocation = { lat: 44.0176, lon: 1.3551, distanceKm: 178.6 };
const OLD_SIGNED_PHOTO =
  'https://pictures.lacentrale.fr/classifieds/B104314094_STANDARD_0.jpg?format=webp&size=352x264&watermark=lc&signature=1c2039874873bf1455543ea2b9a772389285cfa3418d906120f4c381';
const NEW_SIGNED_PHOTO =
  'https://pictures.lacentrale.fr/classifieds/B104314094_STANDARD_0.jpg?format=webp&size=352x264&watermark=lc&signature=7f0e5ad2c1b94e3d8a6f2b1c0d9e8f7a6b5c4d3e2f1a0b9c8d7e6f5a';

type DecisionOf<K extends IngestDecision['kind']> = Extract<IngestDecision, { kind: K }>;

const isKind = <K extends IngestDecision['kind']>(decision: IngestDecision, kind: K): decision is DecisionOf<K> => decision.kind === kind;

const ofKind = <K extends IngestDecision['kind']>(decision: IngestDecision, kind: K): DecisionOf<K> => {
  if (!isKind(decision, kind)) {
    throw new Error(`décision « ${decision.kind} » au lieu de « ${kind} »`);
  }
  return decision;
};

const lacentrale = (title: string, fields: Partial<RawListing> = {}): RawListing => ({
  site: 'lacentrale',
  siteLabel: 'La Centrale',
  externalId: '69112345678',
  url: 'https://www.lacentrale.fr/auto-occasion-annonce-69112345678.html',
  title,
  city: 'Libourne',
  postalCode: '33500',
  sellerType: 'particulier',
  ...fields,
});

interface Stored {
  readonly vehicle: Vehicle;
  readonly listing: Listing;
}

const firstReading = (listing: RawListing, location: VehicleLocation, vehicleFields: Partial<Vehicle> = {}): Stored => {
  const created = ofKind(decide(listing, { kind: 'newVehicle', location }, FIRST_READ_AT), 'created');
  return {
    vehicle: { id: 1, ...created.vehicle, ...vehicleFields },
    listing: { id: 1, vehicleId: 1, ...created.newListing },
  };
};

const reread = (listing: RawListing, stored: Stored): IngestDecision => decide(listing, { kind: 'knownListing', ...stored });

const seenElsewhere = (listing: RawListing, stored: Stored): IngestDecision =>
  decide(listing, { kind: 'knownVehicle', vehicle: stored.vehicle, listings: [stored.listing] });

describe("une annonce jamais vue d'une voiture inconnue", () => {
  it('une 911 de particulier à Pessac arrive : un nouveau véhicule retenu, à traiter, avec l’événement « nouveau » Leboncoin', () => {
    // Given
    const listing = leboncoin(LEBONCOIN_911_TITLE);

    // When
    const decision = ofKind(decide(listing, { kind: 'newVehicle', location: PESSAC }), 'created');

    // Then
    expect(decision.vehicle).toEqual({
      fingerprint: fingerprint({ make: 'Porsche', model: '911 Carrera S', family: 'allemandes', year: 2015 }, listing),
      make: 'Porsche',
      model: '911 Carrera S',
      family: 'allemandes',
      year: 2015,
      km: 42000,
      price: 89900,
      city: 'Pessac',
      postalCode: '33600',
      lat: 44.8067,
      lon: -0.6311,
      distanceKm: 5.36,
      status: 'nouveau',
      doNotContact: false,
      matched: true,
      rejections: [],
      messageOverride: null,
      note: null,
      firstSeenAt: NOW,
      lastSeenAt: NOW,
      publishedAt: null,
      notifiedAt: null,
      priceDropped: false,
      reposted: false,
    });
    expect(decision.verdict).toEqual({ pass: true, rejections: [] });
    expect(decision.event).toEqual({ type: 'nouveau', detail: 'Leboncoin', at: NOW });
  });

  it('un titre Leboncoin qui porte prix, kilométrage et année : l’annonce enregistrée les reprend, et son premier prix ouvre l’historique', () => {
    // Given
    const listing = leboncoin(LEBONCOIN_911_TITLE);

    // When
    const decision = ofKind(decide(listing, { kind: 'newVehicle', location: PESSAC }), 'created');

    // Then
    expect(decision.listing).toEqual({ ...listing, price: 89900, km: 42000, year: 2015 });
    expect(decision.newListing).toEqual({
      site: 'leboncoin',
      siteLabel: 'Leboncoin',
      externalId: '2811001234',
      url: 'https://www.leboncoin.fr/ad/voitures/2811001234',
      title: LEBONCOIN_911_TITLE,
      price: 89900,
      km: 42000,
      year: 2015,
      city: 'Pessac',
      postalCode: '33600',
      sellerType: 'particulier',
      imageUrl: null,
      description: null,
      publishedAt: null,
      sourceRef: null,
      firstSeenAt: NOW,
      lastSeenAt: NOW,
    });
    expect(decision.pricePoint).toEqual({ price: 89900, seenAt: NOW });
  });

  it('une Mercedes GLE lue sans prix : enregistrée sans prix ni historique de prix, et écartée faute d’être une supercar', () => {
    // Given
    const listing = leboncoin('Mercedes GLE 350 d 4Matic 2019 60 000 km');

    // When
    const decision = ofKind(decide(listing, { kind: 'newVehicle', location: PESSAC }), 'created');

    // Then
    expect(decision.vehicle).toMatchObject({ price: null, matched: false, rejections: [{ kind: 'notSpecial' }] });
    expect(decision.newListing.price).toBeNull();
    expect(decision.pricePoint).toBeUndefined();
  });

  it('une Clio 1.2 arrive : enregistrée parmi les écartées, ni supercar ni collection', () => {
    // Given
    const listing = leboncoin('Renault Clio 1.2 2016 60 000 km 7 500 €');

    // When
    const decision = ofKind(decide(listing, { kind: 'newVehicle', location: PESSAC }), 'created');

    // Then
    expect(decision.verdict).toEqual({ pass: false, rejections: [{ kind: 'notSpecial' }] });
    expect(decision.vehicle).toMatchObject({ make: 'Renault', model: 'Clio', status: 'nouveau', matched: false });
  });

  it('une 911 d’une ville introuvable : position et distance inconnues, elle n’est pas écartée pour la distance', () => {
    // Given
    const listing = leboncoin(LEBONCOIN_911_TITLE, { city: 'Lieu-dit les Arbousiers', postalCode: undefined });

    // When
    const decision = ofKind(decide(listing, { kind: 'newVehicle', location: UNKNOWN_LOCATION }), 'created');

    // Then
    expect(decision.vehicle).toMatchObject({ lat: null, lon: null, distanceKm: null, matched: true, rejections: [] });
  });

  it('une 911 de Montauban, à 179 km de Bordeaux, est écartée hors du rayon de 100 km', () => {
    // Given
    const listing = leboncoin(LEBONCOIN_911_TITLE, { city: 'Montauban', postalCode: '82000' });

    // When
    const decision = ofKind(decide(listing, { kind: 'newVehicle', location: MONTAUBAN }), 'created');

    // Then
    expect(decision.verdict.rejections).toEqual([{ kind: 'outsideRadius', distanceKm: 178.6, radiusKm: 100 }]);
  });

  it('une annonce La Centrale mise en ligne le 12 octobre donne cette date de publication au véhicule', () => {
    // Given
    const listing = lacentrale('Mercedes-AMG C63 S Coupé', {
      price: 64900,
      km: 45200,
      year: 2019,
      publishedAt: '2026-10-12T07:40:00.000Z',
    });

    // When
    const decision = ofKind(decide(listing, { kind: 'newVehicle', location: LIBOURNE }), 'created');

    // Then
    expect(decision.vehicle.publishedAt).toBe('2026-10-12T07:40:00.000Z');
    expect(decision.newListing.publishedAt).toBe('2026-10-12T07:40:00.000Z');
  });

  it('le texte d’annonce extrait d’un email est enregistré sans les espaces qui l’entourent, et un site qui ne dit pas qui vend donne un vendeur « inconnu »', () => {
    // Given
    const listing = leboncoin(LEBONCOIN_911_TITLE, {
      sellerType: undefined,
      description: '\n  Première main, carnet Porsche complet.  \n',
    });

    // When
    const decision = ofKind(decide(listing, { kind: 'newVehicle', location: PESSAC }), 'created');

    // Then
    expect(decision.newListing).toMatchObject({ description: 'Première main, carnet Porsche complet.', sellerType: 'inconnu' });
  });
});

describe('la même annonce relue avec un autre prix', () => {
  it('la 911 de Leboncoin relue à 84 900 € : la baisse est enregistrée sur l’annonce, le véhicule et l’historique, avec l’événement « 89900 → 84900 »', () => {
    // Given
    const stored = firstReading(leboncoin(LEBONCOIN_911_TITLE), PESSAC);
    const listing = leboncoin('Porsche 911 Carrera S 2015 42 000 km 84 900 €');

    // When
    const decision = reread(listing, stored);

    // Then
    expect(decision).toEqual({
      kind: 'priceChanged',
      vehicleId: 1,
      listingId: 1,
      listing: { ...listing, price: 84900, km: 42000, year: 2015 },
      from: 89900,
      to: 84900,
      pricePoint: { price: 84900, seenAt: NOW },
      listingChanges: { price: 84900, lastSeenAt: NOW },
      vehicleChanges: { price: 84900, priceDropped: true, lastSeenAt: NOW },
      vehicle: { ...stored.vehicle, price: 84900, priceDropped: true, lastSeenAt: NOW },
      event: { type: 'prix_baisse', detail: '89900 → 84900', at: NOW },
    });
  });

  it('une 911 contactée dont le prix baisse garde son statut et son verdict', () => {
    // Given
    const stored = firstReading(leboncoin(LEBONCOIN_911_TITLE), PESSAC, { status: 'contacte' });

    // When
    const decision = ofKind(reread(leboncoin(LEBONCOIN_911_TITLE, { price: 84900 }), stored), 'priceChanged');

    // Then
    expect(decision.vehicleChanges).toEqual({ price: 84900, priceDropped: true, lastSeenAt: NOW });
    expect(decision.vehicle).toMatchObject({ status: 'contacte', matched: true });
  });

  it('une hausse à 92 900 € après une baisse : événement « prix_hausse » et l’étiquette « Prix baissé » retirée', () => {
    // Given
    const stored = firstReading(leboncoin('Porsche 911 Carrera S 2015 42 000 km 84 900 €'), PESSAC, { priceDropped: true });

    // When
    const decision = ofKind(reread(leboncoin('Porsche 911 Carrera S 2015 42 000 km 92 900 €'), stored), 'priceChanged');

    // Then
    expect(decision.vehicleChanges).toEqual({ price: 92900, priceDropped: false, lastSeenAt: NOW });
    expect(decision.event).toEqual({ type: 'prix_hausse', detail: '84900 → 92900', at: NOW });
  });

  it('comportement hérité : une baisse relue avec une nouvelle photo et un texte : seul le prix est mis à jour, la photo et le texte attendent une relecture au même prix', () => {
    // Given
    const stored = firstReading(
      lacentrale('Mercedes-AMG C63 S Coupé', { price: 64900, km: 45200, year: 2019, imageUrl: OLD_SIGNED_PHOTO }),
      LIBOURNE,
    );
    const listing = lacentrale('Mercedes-AMG C63 S Coupé', {
      price: 61900,
      km: 45200,
      year: 2019,
      imageUrl: NEW_SIGNED_PHOTO,
      description: 'Pack Performance, échappement AMG.',
      publishedAt: '2026-10-06T10:00:00.000Z',
    });

    // When
    const decision = ofKind(reread(listing, stored), 'priceChanged');

    // Then
    expect(decision.listingChanges).toEqual({ price: 61900, lastSeenAt: NOW });
    expect(decision.vehicleChanges).toEqual({ price: 61900, priceDropped: true, lastSeenAt: NOW });
  });
});

describe('la même annonce relue au même prix, ou sans prix', () => {
  it('la même annonce relue sans rien de neuf : seules les dates de dernière lecture avancent, le verdict reste', () => {
    // Given
    const stored = firstReading(
      lacentrale('Mercedes-AMG C63 S Coupé', { price: 64900, km: 45200, year: 2019, imageUrl: OLD_SIGNED_PHOTO }),
      LIBOURNE,
    );

    // When
    const decision = reread(
      lacentrale('Mercedes-AMG C63 S Coupé', { price: 64900, km: 45200, year: 2019, imageUrl: OLD_SIGNED_PHOTO }),
      stored,
    );

    // Then
    expect(decision).toEqual({
      kind: 'seenAgain',
      vehicleId: 1,
      listingId: 1,
      listingChanges: { lastSeenAt: NOW },
      vehicleChanges: { lastSeenAt: NOW },
      verdict: undefined,
    });
  });

  it('le lien de photo signé d’une annonce La Centrale relue remplace l’ancien, dont la signature peut avoir expiré', () => {
    // Given
    const stored = firstReading(
      lacentrale('Mercedes-AMG C63 S Coupé', { price: 64900, km: 45200, year: 2019, imageUrl: OLD_SIGNED_PHOTO }),
      LIBOURNE,
    );

    // When
    const decision = ofKind(
      reread(lacentrale('Mercedes-AMG C63 S Coupé', { price: 64900, imageUrl: NEW_SIGNED_PHOTO }), stored),
      'seenAgain',
    );

    // Then
    expect(decision.listingChanges).toEqual({ imageUrl: NEW_SIGNED_PHOTO, lastSeenAt: NOW });
    expect(decision.vehicleChanges).toEqual({ lastSeenAt: NOW });
  });

  it('une Mercedes GLE lue d’abord sans prix puis relue à 52 000 € : le prix complète l’annonce et la fiche, sans événement de prix, et le verdict rafraîchi la retient', () => {
    // Given
    const stored = firstReading(leboncoin('Mercedes GLE 350 d 4Matic 2019 60 000 km'), PESSAC);

    // When
    const decision = reread(leboncoin('Mercedes GLE 350 d 4Matic 2019 60 000 km', { price: 52000 }), stored);

    // Then
    expect(decision).toEqual({
      kind: 'seenAgain',
      vehicleId: 1,
      listingId: 1,
      listingChanges: { price: 52000, lastSeenAt: NOW },
      vehicleChanges: { price: 52000, matched: true, rejections: [], lastSeenAt: NOW },
      verdict: { pass: true, rejections: [] },
    });
  });

  it('la même GLE déjà contactée, relue avec son prix : le prix complète la fiche, mais la décision prise ne bouge pas', () => {
    // Given
    const stored = firstReading(leboncoin('Mercedes GLE 350 d 4Matic 2019 60 000 km'), PESSAC, { status: 'contacte' });

    // When
    const decision = ofKind(reread(leboncoin('Mercedes GLE 350 d 4Matic 2019 60 000 km', { price: 52000 }), stored), 'seenAgain');

    // Then
    expect(decision.vehicleChanges).toEqual({ price: 52000, lastSeenAt: NOW });
    expect(decision.verdict).toBeUndefined();
  });

  it('la même GLE mise en « ne plus contacter », donc ignorée, relue avec son prix : le verdict n’est pas rafraîchi', () => {
    // Given
    const stored = firstReading(leboncoin('Mercedes GLE 350 d 4Matic 2019 60 000 km'), PESSAC, { status: 'ignore', doNotContact: true });

    // When
    const decision = ofKind(reread(leboncoin('Mercedes GLE 350 d 4Matic 2019 60 000 km', { price: 52000 }), stored), 'seenAgain');

    // Then
    expect(decision.vehicleChanges).toEqual({ price: 52000, lastSeenAt: NOW });
    expect(decision.verdict).toBeUndefined();
  });

  it('une 911 à 142 000 km mise en « ne plus contacter », écartée quand le plafond est passé à 100 000 km puis gardée quand même : relue avec son prix, son verdict n’est pas recalculé', () => {
    // Given
    const stored = firstReading(leboncoin('Porsche 911 Carrera S 2015 142 000 km'), PESSAC, {
      status: 'nouveau',
      doNotContact: true,
      matched: true,
      rejections: [],
    });

    // When
    const decision = ofKind(reread(leboncoin('Porsche 911 Carrera S 2015 142 000 km', { price: 59900 }), stored), 'seenAgain');

    // Then
    expect(decision.vehicleChanges).toEqual({ price: 59900, lastSeenAt: NOW });
    expect(decision.verdict).toBeUndefined();
  });

  it('une 911 de Montauban lue sans prix puis complétée reste écartée hors du rayon : le verdict rafraîchi garde la distance du véhicule', () => {
    // Given
    const montauban = { city: 'Montauban', postalCode: '82000' };
    const stored = firstReading(leboncoin('Porsche 911 Carrera S 2015 42 000 km', montauban), MONTAUBAN);

    // When
    const decision = ofKind(reread(leboncoin('Porsche 911 Carrera S 2015 42 000 km', { ...montauban, price: 89900 }), stored), 'seenAgain');

    // Then
    expect(decision.verdict).toEqual({ pass: false, rejections: [{ kind: 'outsideRadius', distanceKm: 178.6, radiusKm: 100 }] });
  });

  it('une 911 lue sans kilométrage puis relue à 142 000 km passe parmi les écartées', () => {
    // Given
    const stored = firstReading(leboncoin('Porsche 911 Carrera S 2015 59 900 €'), PESSAC);

    // When
    const decision = ofKind(reread(leboncoin('Porsche 911 Carrera S 2015 142 000 km 59 900 €'), stored), 'seenAgain');

    // Then
    expect(decision.vehicleChanges).toEqual({
      km: 142000,
      matched: false,
      rejections: [{ kind: 'mileageAbove', km: 142000, maxKm: 100000 }],
      lastSeenAt: NOW,
    });
  });

  it('une Mercedes 190 E à 6 500 € lue sans année puis relue « 1989 » est retenue comme voiture de collection', () => {
    // Given
    const stored = firstReading(leboncoin('Mercedes 190 E 2.0 6 500 €'), PESSAC);

    // When
    const decision = ofKind(reread(leboncoin('Mercedes 190 E 2.0 1989 6 500 €'), stored), 'seenAgain');

    // Then
    expect(stored.vehicle).toMatchObject({ matched: false, rejections: [{ kind: 'notSpecial' }] });
    expect(decision.vehicleChanges).toEqual({ year: 1989, matched: true, rejections: [], lastSeenAt: NOW });
  });

  it('une Ferrari 360 lue d’abord sans kilométrage ni année puis relue avec : la fiche est complétée', () => {
    // Given
    const stored = firstReading(lacentrale('Ferrari 360 Modena F1', { price: 79000 }), LIBOURNE);

    // When
    const decision = ofKind(reread(lacentrale('Ferrari 360 Modena F1', { price: 79000, km: 45000, year: 2001 }), stored), 'seenAgain');

    // Then
    expect(decision.vehicleChanges).toEqual({ km: 45000, year: 2001, matched: true, rejections: [], lastSeenAt: NOW });
  });

  it('une annonce enregistrée sans texte ni date reçoit ceux de la relecture, et le véhicule cette date de publication', () => {
    // Given
    const stored = firstReading(lacentrale('Mercedes-AMG C63 S Coupé', { price: 64900, km: 45200, year: 2019 }), LIBOURNE);
    const listing = lacentrale('Mercedes-AMG C63 S Coupé', {
      price: 64900,
      description: 'Pack Performance, échappement AMG.',
      publishedAt: '2026-10-06T10:00:00.000Z',
    });

    // When
    const decision = ofKind(reread(listing, stored), 'seenAgain');

    // Then
    expect(decision.listingChanges).toEqual({
      description: 'Pack Performance, échappement AMG.',
      publishedAt: '2026-10-06T10:00:00.000Z',
      lastSeenAt: NOW,
    });
    expect(decision.vehicleChanges).toMatchObject({ publishedAt: '2026-10-06T10:00:00.000Z' });
  });

  it('comportement hérité : le texte d’une annonce La Centrale enregistrée sans texte, complété à la relecture, garde les espaces et retours à la ligne qui l’entourent', () => {
    // Given
    const stored = firstReading(lacentrale('Mercedes-AMG C63 S Coupé', { price: 64900, km: 45200, year: 2019 }), LIBOURNE);
    const listing = lacentrale('Mercedes-AMG C63 S Coupé', { price: 64900, description: '\n  Pack Performance, échappement AMG.  \n' });

    // When
    const decision = ofKind(reread(listing, stored), 'seenAgain');

    // Then
    expect(decision.listingChanges).toEqual({ description: '\n  Pack Performance, échappement AMG.  \n', lastSeenAt: NOW });
  });

  it('le texte et la date déjà connus d’une annonce ne sont pas remplacés par ceux d’une relecture plus récente', () => {
    // Given
    const stored = firstReading(
      lacentrale('Mercedes-AMG C63 S Coupé', {
        price: 64900,
        description: 'Pack Performance, échappement AMG.',
        publishedAt: '2026-10-06T10:00:00.000Z',
      }),
      LIBOURNE,
    );
    const listing = lacentrale('Mercedes-AMG C63 S Coupé', {
      price: 64900,
      description: 'Prix ferme, pas d’échange.',
      publishedAt: '2026-10-13T10:00:00.000Z',
    });

    // When
    const decision = ofKind(reread(listing, stored), 'seenAgain');

    // Then
    expect(decision.listingChanges).toEqual({ lastSeenAt: NOW });
    expect(decision.vehicleChanges).toEqual({ lastSeenAt: NOW });
  });

  it('« Tout relire » retrouve un vieil email qui date l’annonce du 2 octobre : le véhicule prend cette date plus ancienne, l’annonce garde la sienne', () => {
    // Given
    const stored = firstReading(
      lacentrale('Mercedes-AMG C63 S Coupé', { price: 64900, publishedAt: '2026-10-06T10:00:00.000Z' }),
      LIBOURNE,
    );

    // When
    const decision = ofKind(
      reread(lacentrale('Mercedes-AMG C63 S Coupé', { price: 64900, publishedAt: '2026-10-02T10:00:00.000Z' }), stored),
      'seenAgain',
    );

    // Then
    expect(decision.listingChanges).toEqual({ lastSeenAt: NOW });
    expect(decision.vehicleChanges).toEqual({ publishedAt: '2026-10-02T10:00:00.000Z', matched: true, rejections: [], lastSeenAt: NOW });
  });

  it('comportement hérité : une Clio gardée à la main mais pas encore contactée, relue avec son prix, repasse parmi les écartées', () => {
    // Given
    const stored = firstReading(leboncoin('Renault Clio 1.2 2016 60 000 km'), PESSAC, { matched: true, rejections: [] });

    // When
    const decision = ofKind(reread(leboncoin('Renault Clio 1.2 2016 60 000 km', { price: 7500 }), stored), 'seenAgain');

    // Then
    expect(decision.vehicleChanges).toMatchObject({ matched: false, rejections: [{ kind: 'notSpecial' }] });
  });
});

describe('une nouvelle annonce de la même voiture', () => {
  it('une 911 contactée, republiée sous un nouvel id sur Leboncoin : rattachée à la même voiture, étiquette « Republiée », statut inchangé', () => {
    // Given
    const stored = firstReading(leboncoin(LEBONCOIN_911_TITLE), PESSAC, { status: 'contacte' });
    const listing = leboncoin(LEBONCOIN_911_TITLE, { externalId: '2811004321', url: 'https://www.leboncoin.fr/ad/voitures/2811004321' });

    // When
    const decision = seenElsewhere(listing, stored);

    // Then
    expect(decision).toEqual({
      kind: 'attachedToVehicle',
      attachment: 'repost',
      vehicleId: 1,
      newListing: {
        site: 'leboncoin',
        siteLabel: 'Leboncoin',
        externalId: '2811004321',
        url: 'https://www.leboncoin.fr/ad/voitures/2811004321',
        title: LEBONCOIN_911_TITLE,
        price: 89900,
        km: 42000,
        year: 2015,
        city: 'Pessac',
        postalCode: '33600',
        sellerType: 'particulier',
        imageUrl: null,
        description: null,
        publishedAt: null,
        sourceRef: null,
        firstSeenAt: NOW,
        lastSeenAt: NOW,
      },
      pricePoint: { price: 89900, seenAt: NOW },
      vehicleChanges: { reposted: true, lastSeenAt: NOW },
      event: { type: 'republiee', detail: 'Leboncoin https://www.leboncoin.fr/ad/voitures/2811004321', at: NOW },
    });
  });

  it('la même 911 vue ensuite sur La Centrale est rattachée à la voiture de Leboncoin, sans étiquette « Republiée »', () => {
    // Given
    const stored = firstReading(leboncoin(LEBONCOIN_911_TITLE), PESSAC);
    const listing = lacentrale('PORSCHE 911 CARRERA S PDK', { year: 2015, km: 43000, price: 88500, postalCode: '33600', city: 'Pessac' });

    // When
    const decision = ofKind(seenElsewhere(listing, stored), 'attachedToVehicle');

    // Then
    expect(decision.attachment).toBe('otherSite');
    expect(decision.vehicleChanges).toEqual({ reposted: false, lastSeenAt: NOW });
    expect(decision.event).toEqual({
      type: 'autre_site',
      detail: 'La Centrale https://www.lacentrale.fr/auto-occasion-annonce-69112345678.html',
      at: NOW,
    });
  });

  it('une 911 déjà republiée sur Leboncoin, vue ensuite sur La Centrale, garde son étiquette « Republiée »', () => {
    // Given
    const stored = firstReading(leboncoin(LEBONCOIN_911_TITLE), PESSAC, { reposted: true });
    const listing = lacentrale('PORSCHE 911 CARRERA S PDK', { year: 2015, km: 43000, price: 88500 });

    // When
    const decision = ofKind(seenElsewhere(listing, stored), 'attachedToVehicle');

    // Then
    expect(decision.vehicleChanges).toEqual({ reposted: true, lastSeenAt: NOW });
  });

  it('la 911 vue sur La Centrale, en ligne depuis plus longtemps que sur Leboncoin : le véhicule prend la date la plus ancienne', () => {
    // Given
    const stored = firstReading(leboncoin(LEBONCOIN_911_TITLE, { publishedAt: '2026-10-07T18:00:00.000Z' }), PESSAC);
    const older = lacentrale('PORSCHE 911 CARRERA S PDK', { year: 2015, km: 43000, price: 88500, publishedAt: '2026-09-28T09:00:00.000Z' });
    const newer = lacentrale('PORSCHE 911 CARRERA S PDK', { year: 2015, km: 43000, price: 88500, publishedAt: '2026-10-09T09:00:00.000Z' });

    // When
    const olderDecision = ofKind(seenElsewhere(older, stored), 'attachedToVehicle');
    const newerDecision = ofKind(seenElsewhere(newer, stored), 'attachedToVehicle');

    // Then
    expect(olderDecision.vehicleChanges).toEqual({ reposted: false, publishedAt: '2026-09-28T09:00:00.000Z', lastSeenAt: NOW });
    expect(newerDecision.vehicleChanges).toEqual({ reposted: false, lastSeenAt: NOW });
  });
});
