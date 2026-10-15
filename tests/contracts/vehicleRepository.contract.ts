import { describe, expect, it } from 'vitest';
import type { VehicleRepository, VehicleSelection } from '../../src/application/ports/vehicleRepository.js';
import { haversineKm } from '../../src/domain/geo/distance.js';
import { newListing } from '../../src/domain/vehicle/changes.js';
import type { RawListing } from '../../src/domain/vehicle/types.js';
import {
  ALPINE_A110,
  ARTEGA_GT,
  AUDI_A3,
  BMW_M3_E46,
  CORVETTE_C7,
  FERRARI_360,
  FORD_MUSTANG_MERGED,
  FORD_RANGER_RAPTOR,
  firstSighting,
  MAZDA_5,
  MERCEDES_C63,
  MERCEDES_C63_REPOSTED,
  MUSTANG_GT,
  PEUGEOT_205_GTI,
  PORSCHE_911_4S,
  PORSCHE_997_PRO,
  type StoredSighting,
  store,
  storeFirstSighting,
  TOYOTA_GR_YARIS,
} from './vehicleSamples.js';

const WEEK_START = '2026-10-08T08:30:00.000Z';
const THREE_DAYS_AGO = '2026-10-12T08:30:00.000Z';
const FORTNIGHT_START = '2026-10-01T08:30:00.000Z';
const NOUVEAU: VehicleSelection = { kind: 'kept', status: 'nouveau' };

const reposted = (raw: RawListing, externalId: string): RawListing => ({
  ...raw,
  externalId,
  url: raw.url.replace(raw.externalId, externalId),
});

const ids = (sightings: readonly StoredSighting[]): readonly number[] => sightings.map((sighting) => sighting.vehicleId);

interface RejectedOfTheFortnight {
  readonly mazda: StoredSighting;
  readonly toyota: StoredSighting;
  readonly audi: StoredSighting;
  readonly bmw: StoredSighting;
  readonly porsche997: StoredSighting;
}

const rejectedOfTheFortnight = (repository: VehicleRepository): RejectedOfTheFortnight => {
  storeFirstSighting(repository, reposted(AUDI_A3, '2810990001'), '2026-09-24T07:40:00.000Z', {
    matched: false,
    rejections: [{ kind: 'notSpecial' }],
  });
  const porsche997 = storeFirstSighting(repository, PORSCHE_997_PRO, '2026-10-09T06:10:00.000Z', {
    matched: false,
    rejections: [{ kind: 'professionalSeller' }, { kind: 'outsideRadius', distanceKm: 107.4, radiusKm: 100 }],
  });
  const bmw = storeFirstSighting(repository, BMW_M3_E46, '2026-10-10T07:35:00.000Z', {
    matched: false,
    rejections: [{ kind: 'mileageAbove', km: 128000, maxKm: 100000 }],
  });
  const audi = storeFirstSighting(repository, AUDI_A3, '2026-10-11T08:15:00.000Z', {
    matched: false,
    rejections: [{ kind: 'notSpecial' }],
  });
  const toyota = storeFirstSighting(repository, TOYOTA_GR_YARIS, '2026-10-12T06:58:00.000Z', {
    matched: false,
    rejections: [{ kind: 'unfollowedBrand', make: 'Toyota' }],
  });
  const mazda = storeFirstSighting(repository, MAZDA_5, '2026-10-13T07:02:00.000Z', {
    matched: false,
    rejections: [{ kind: 'unfollowedBrand', make: 'Mazda' }],
  });
  storeFirstSighting(repository, PORSCHE_911_4S, '2026-10-13T07:20:00.000Z', { matched: true, rejections: [] });
  return { mazda, toyota, audi, bmw, porsche997 };
};

export function vehicleRepositoryContract(create: () => VehicleRepository): void {
  describe('une voiture et ses annonces', () => {
    it('une 911 Carrera 4S arrivée de Leboncoin se relit telle qu’elle a été enregistrée, et se retrouve par son annonce', () => {
      // Given
      const repository = create();
      const sighting = firstSighting(PORSCHE_911_4S, '2026-10-13T07:02:11.000Z');

      // When
      const { vehicleId, listingId } = store(repository, sighting);

      // Then
      const vehicle = { id: vehicleId, ...sighting.vehicle };
      expect(repository.vehicle(vehicleId)).toEqual(vehicle);
      expect(repository.findListing('leboncoin', '2811001234')).toEqual({
        listing: { id: listingId, vehicleId, ...sighting.listing },
        vehicle,
      });
      expect(repository.findListing('lacentrale', '2811001234')).toBeUndefined();
    });

    it('une annonce Leboncoin enregistrée à 112 900 € n’ouvre pas d’historique d’elle-même : le premier point est celui que l’ingestion ajoute', () => {
      // Given
      const repository = create();
      const { listingId } = storeFirstSighting(repository, PORSCHE_911_4S, '2026-10-13T07:02:11.000Z');
      const historyBefore = repository.priceHistory(listingId);

      // When
      repository.addPricePoint(listingId, { price: 112900, seenAt: '2026-10-13T07:02:11.000Z' });

      // Then
      expect(historyBefore).toEqual([]);
      expect(repository.priceHistory(listingId)).toEqual([{ price: 112900, seenAt: '2026-10-13T07:02:11.000Z' }]);
    });

    it('la même annonce Leboncoin lue au même moment par la boîte mail et par un import : la seconde écriture échoue', () => {
      // Given
      const repository = create();
      const sighting = firstSighting(PORSCHE_911_4S, '2026-10-13T07:02:11.000Z');
      store(repository, sighting);
      const duplicate = repository.addVehicle(sighting.vehicle);

      // When
      const writeTwice = (): number => repository.addListing(duplicate, sighting.listing);

      // Then
      expect(writeTwice).toThrow();
    });

    it('une annonce republiée rejoint le véhicule et garde son historique de prix', () => {
      // Given
      const repository = create();
      const first = storeFirstSighting(repository, MERCEDES_C63, '2026-10-06T07:15:00.000Z');
      repository.addPricePoint(first.listingId, { price: 64900, seenAt: '2026-10-06T07:15:00.000Z' });
      repository.addPricePoint(first.listingId, { price: 63900, seenAt: '2026-10-09T18:40:00.000Z' });

      // When
      const repostId = repository.addListing(first.vehicleId, newListing(MERCEDES_C63_REPOSTED, '2026-10-12T06:58:00.000Z'));
      repository.addPricePoint(repostId, { price: 62900, seenAt: '2026-10-12T06:58:00.000Z' });

      // Then
      expect(repository.findListing('lacentrale', '69112345999')?.vehicle.id).toBe(first.vehicleId);
      expect(repository.listingsOf(first.vehicleId).map((listing) => listing.externalId)).toEqual(['69112345678', '69112345999']);
      expect(repository.priceHistory(first.listingId)).toEqual([
        { price: 64900, seenAt: '2026-10-06T07:15:00.000Z' },
        { price: 63900, seenAt: '2026-10-09T18:40:00.000Z' },
      ]);
      expect(repository.priceHistory(repostId)).toEqual([{ price: 62900, seenAt: '2026-10-12T06:58:00.000Z' }]);
    });

    it('les annonces de la Ferrari 360 vue sur ParuVendu, puis Leboncoin, puis La Centrale vont de la première lue à la dernière', () => {
      // Given
      const repository = create();
      const paruVendu = storeFirstSighting(repository, FERRARI_360, '2026-10-09T06:10:02.000Z');
      const onLeboncoin: RawListing = {
        ...FERRARI_360,
        site: 'leboncoin',
        siteLabel: 'Leboncoin',
        externalId: '2811000360',
        url: 'https://www.leboncoin.fr/ad/voitures/2811000360',
      };
      const onLaCentrale: RawListing = {
        ...FERRARI_360,
        site: 'lacentrale',
        siteLabel: 'La Centrale',
        externalId: '69100000360',
        url: 'https://www.lacentrale.fr/auto-occasion-annonce-69100000360.html',
      };

      // When
      repository.addListing(paruVendu.vehicleId, newListing(onLeboncoin, '2026-10-10T07:35:41.000Z'));
      repository.addListing(paruVendu.vehicleId, newListing(onLaCentrale, '2026-10-11T06:58:03.000Z'));

      // Then
      expect(repository.listingsOf(paruVendu.vehicleId).map((listing) => listing.site)).toEqual(['paruvendu', 'leboncoin', 'lacentrale']);
    });

    it('la même Ferrari 360 importée de ParuVendu et de La Centrale dans la même milliseconde : la première importée reste la première annonce', () => {
      // Given
      const repository = create();
      const sameImport = '2026-10-11T06:58:03.412Z';
      const paruVendu = storeFirstSighting(repository, FERRARI_360, sameImport);
      const onLaCentrale: RawListing = {
        ...FERRARI_360,
        site: 'lacentrale',
        siteLabel: 'La Centrale',
        externalId: '69100000360',
        url: 'https://www.lacentrale.fr/auto-occasion-annonce-69100000360.html',
      };

      // When
      repository.addListing(paruVendu.vehicleId, newListing(onLaCentrale, sameImport));

      // Then
      expect(repository.listingsOf(paruVendu.vehicleId).map((listing) => listing.site)).toEqual(['paruvendu', 'lacentrale']);
    });

    it('la 911 enregistrée à 112 900 € puis baissée à 109 900 € dans la même milliseconde par la même passe de la boîte : l’historique garde l’ordre d’enregistrement', () => {
      // Given
      const repository = create();
      const samePass = '2026-10-14T06:45:00.218Z';
      const { listingId } = storeFirstSighting(repository, PORSCHE_911_4S, samePass);

      // When
      repository.addPricePoint(listingId, { price: 112900, seenAt: samePass });
      repository.addPricePoint(listingId, { price: 109900, seenAt: samePass });

      // Then
      expect(repository.priceHistory(listingId)).toEqual([
        { price: 112900, seenAt: samePass },
        { price: 109900, seenAt: samePass },
      ]);
    });

    it('deux 911 Carrera 4S de même empreinte : la plus récemment vue est proposée d’abord, et à date égale la première enregistrée', () => {
      // Given
      const repository = create();
      const older = storeFirstSighting(repository, PORSCHE_911_4S, '2026-10-01T07:00:00.000Z', { lastSeenAt: '2026-10-10T07:00:00.000Z' });
      const recent = storeFirstSighting(repository, { ...reposted(PORSCHE_911_4S, '2811001300'), km: 95000 }, '2026-10-02T07:00:00.000Z', {
        lastSeenAt: '2026-10-12T07:00:00.000Z',
      });
      const sameTime = storeFirstSighting(
        repository,
        { ...reposted(PORSCHE_911_4S, '2811001400'), km: 140000 },
        '2026-10-03T07:00:00.000Z',
        {
          lastSeenAt: '2026-10-12T07:00:00.000Z',
        },
      );
      storeFirstSighting(repository, FERRARI_360, '2026-10-12T07:00:00.000Z');
      const fingerprint = repository.vehicle(older.vehicleId)?.fingerprint ?? '';

      // When
      const candidates = repository.vehiclesWithFingerprint(fingerprint);

      // Then
      expect(candidates.map((candidate) => candidate.id)).toEqual(ids([recent, sameTime, older]));
    });

    it('« Réparer » : l’annonce de la Mustang fusionnée à tort avec le ranger raptor passe sur sa propre voiture', () => {
      // Given
      const repository = create();
      const ford = storeFirstSighting(repository, FORD_RANGER_RAPTOR, '2026-10-05T07:00:00.000Z');
      const mergedId = repository.addListing(ford.vehicleId, newListing(FORD_MUSTANG_MERGED, '2026-10-06T07:00:00.000Z'));
      const mustangId = repository.addVehicle(firstSighting(FORD_MUSTANG_MERGED, '2026-10-06T07:00:00.000Z').vehicle);

      // When
      repository.moveListings([mergedId], mustangId);

      // Then
      expect(repository.listingsOf(ford.vehicleId).map((listing) => listing.externalId)).toEqual(['2811002222']);
      expect(repository.listingsOf(mustangId)).toEqual([
        { id: mergedId, vehicleId: mustangId, ...newListing(FORD_MUSTANG_MERGED, '2026-10-06T07:00:00.000Z') },
      ]);
      expect(repository.findListing('leboncoin', '2811002223')?.vehicle.id).toBe(mustangId);
    });

    it('supprimer une annonce lue de travers efface la voiture, ses annonces, son historique de prix et ses événements', () => {
      // Given
      const repository = create();
      const wrong = storeFirstSighting(repository, PORSCHE_911_4S, '2026-10-13T07:02:11.000Z');
      repository.addPricePoint(wrong.listingId, { price: 112900, seenAt: '2026-10-13T07:02:11.000Z' });
      repository.addEvent(wrong.vehicleId, { type: 'nouveau', detail: 'Leboncoin', at: '2026-10-13T07:02:11.000Z' });
      const other = storeFirstSighting(repository, FERRARI_360, '2026-10-13T07:05:00.000Z');

      // When
      repository.deleteVehicle(wrong.vehicleId);

      // Then
      expect(repository.vehicle(wrong.vehicleId)).toBeUndefined();
      expect(repository.listingsOf(wrong.vehicleId)).toEqual([]);
      expect(repository.findListing('leboncoin', '2811001234')).toBeUndefined();
      expect(repository.priceHistory(wrong.listingId)).toEqual([]);
      expect(repository.events(wrong.vehicleId)).toEqual([]);
      expect(repository.vehicle(other.vehicleId)?.id).toBe(other.vehicleId);
    });

    it('après la suppression d’une annonce, la suivante ne reprend pas son numéro : les liens des notifications déjà envoyées restent justes', () => {
      // Given
      const repository = create();
      storeFirstSighting(repository, PORSCHE_911_4S, '2026-10-13T07:02:11.000Z');
      const deleted = storeFirstSighting(repository, MERCEDES_C63, '2026-10-13T07:03:00.000Z');
      repository.deleteVehicle(deleted.vehicleId);

      // When
      const next = storeFirstSighting(repository, FERRARI_360, '2026-10-13T07:05:00.000Z');

      // Then
      expect(next.vehicleId).toBeGreaterThan(deleted.vehicleId);
      expect(next.listingId).toBeGreaterThan(deleted.listingId);
    });
  });

  describe('ce que les lectures et les décisions changent sur une fiche', () => {
    it('une baisse de prix relue sur Leboncoin met à jour l’annonce et la voiture sans toucher au statut ni à la note', () => {
      // Given
      const repository = create();
      const { vehicleId, listingId } = storeFirstSighting(repository, PORSCHE_911_4S, '2026-10-12T07:00:00.000Z', {
        status: 'contacte',
        note: 'Rendez-vous samedi 10 h',
      });
      const before = repository.findListing('leboncoin', '2811001234');

      // When
      repository.recordListingSighting(listingId, { price: 109900, lastSeenAt: '2026-10-14T06:45:00.000Z' });
      repository.recordVehicleSighting(vehicleId, { price: 109900, priceDropped: true, lastSeenAt: '2026-10-14T06:45:00.000Z' });

      // Then
      expect(repository.findListing('leboncoin', '2811001234')).toEqual({
        listing: { ...before?.listing, price: 109900, lastSeenAt: '2026-10-14T06:45:00.000Z' },
        vehicle: { ...before?.vehicle, price: 109900, priceDropped: true, lastSeenAt: '2026-10-14T06:45:00.000Z' },
      });
    });

    it('une annonce La Centrale relue avec sa photo, son texte et sa date est complétée, le reste de la fiche ne bouge pas', () => {
      // Given
      const repository = create();
      const { vehicleId, listingId } = storeFirstSighting(repository, MERCEDES_C63, '2026-10-12T07:00:00.000Z');
      const before = repository.findListing('lacentrale', '69112345678');
      const photo = 'https://pictures.lacentrale.fr/classifieds/E112345678_STANDARD_0.jpg?sig=b81f';
      const text = 'Mercedes-AMG C63 S Coupé, première main, carnet complet, 45 200 km';

      // When
      repository.recordListingSighting(listingId, {
        imageUrl: photo,
        description: text,
        publishedAt: '2026-10-11T19:20:00.000Z',
        lastSeenAt: '2026-10-13T06:58:00.000Z',
      });
      repository.recordVehicleSighting(vehicleId, { publishedAt: '2026-10-11T19:20:00.000Z', lastSeenAt: '2026-10-13T06:58:00.000Z' });

      // Then
      expect(repository.findListing('lacentrale', '69112345678')).toEqual({
        listing: {
          ...before?.listing,
          imageUrl: photo,
          description: text,
          publishedAt: '2026-10-11T19:20:00.000Z',
          lastSeenAt: '2026-10-13T06:58:00.000Z',
        },
        vehicle: { ...before?.vehicle, publishedAt: '2026-10-11T19:20:00.000Z', lastSeenAt: '2026-10-13T06:58:00.000Z' },
      });
    });

    it('une BMW M3 E46 enregistrée sans kilométrage ni année, relue avec 128 000 km et 2004 : la fiche est complétée et la voiture passe parmi les écartées', () => {
      // Given
      const repository = create();
      const { vehicleId } = storeFirstSighting(repository, BMW_M3_E46, '2026-10-12T07:35:00.000Z', {
        km: null,
        year: null,
        matched: true,
        rejections: [],
      });
      const before = repository.vehicle(vehicleId);
      const tooManyKm = { kind: 'mileageAbove', km: 128000, maxKm: 100000 } as const;

      // When
      repository.recordVehicleSighting(vehicleId, {
        km: 128000,
        year: 2004,
        matched: false,
        rejections: [tooManyKm],
        lastSeenAt: '2026-10-13T07:35:00.000Z',
      });

      // Then
      expect(repository.vehicle(vehicleId)).toEqual({
        ...before,
        km: 128000,
        year: 2004,
        matched: false,
        rejections: [tooManyKm],
        lastSeenAt: '2026-10-13T07:35:00.000Z',
      });
    });

    it('la Mercedes-AMG C63 republiée sous un nouvel identifiant sur La Centrale prend l’étiquette « Republiée », le reste de la fiche ne bouge pas', () => {
      // Given
      const repository = create();
      const { vehicleId } = storeFirstSighting(repository, MERCEDES_C63, '2026-10-06T07:15:00.000Z', { status: 'contacte' });
      repository.addListing(vehicleId, newListing(MERCEDES_C63_REPOSTED, '2026-10-12T06:58:00.000Z'));
      const before = repository.vehicle(vehicleId);

      // When
      repository.recordVehicleSighting(vehicleId, { reposted: true, lastSeenAt: '2026-10-12T06:58:00.000Z' });

      // Then
      expect(repository.vehicle(vehicleId)).toEqual({ ...before, reposted: true, lastSeenAt: '2026-10-12T06:58:00.000Z' });
    });

    it('la réparation renomme la Ford « Autres » enregistrée par une ancienne version, sans toucher à son statut, sa note ni son message', () => {
      // Given
      const repository = create();
      const today = firstSighting(FORD_RANGER_RAPTOR, '2026-10-05T07:00:00.000Z').vehicle;
      const { vehicleId } = storeFirstSighting(repository, FORD_RANGER_RAPTOR, '2026-10-05T07:00:00.000Z', {
        model: 'Autres',
        fingerprint: '0a1b2c3d4e5f6a7b',
        reposted: true,
        status: 'contacte',
        note: 'Vendeur à Pessac, rappeler le soir',
        messageOverride: 'Bonjour, votre ranger raptor m’intéresse.',
      });
      const before = repository.vehicle(vehicleId);

      // When
      repository.applyRegrouping(vehicleId, { model: today.model, fingerprint: today.fingerprint, reposted: false });

      // Then
      expect(repository.vehicle(vehicleId)).toEqual({ ...before, model: today.model, fingerprint: today.fingerprint, reposted: false });
    });

    it('« Réparer » après l’ajout d’Artega aux allemandes : l’Artega GT, enregistrée sans marque reconnue, est nommée, rangée chez les allemandes et retenue', () => {
      // Given
      const repository = create();
      const { vehicleId } = storeFirstSighting(repository, ARTEGA_GT, '2026-10-10T07:00:00.000Z', {
        make: null,
        model: null,
        family: 'autres',
        matched: false,
        rejections: [{ kind: 'unknownBrand' }],
      });
      const before = repository.vehicle(vehicleId);

      // When
      repository.applyRegrouping(vehicleId, { make: 'Artega', model: 'GT', family: 'allemandes', matched: true, rejections: [] });

      // Then
      expect(repository.vehicle(vehicleId)).toEqual({
        ...before,
        make: 'Artega',
        model: 'GT',
        family: 'allemandes',
        matched: true,
        rejections: [],
      });
    });

    it('« Réparer » après le retrait d’Artega des réglages : l’Artega GT garde sa marque et sa famille, mais perd son modèle', () => {
      // Given
      const repository = create();
      const { vehicleId } = storeFirstSighting(repository, ARTEGA_GT, '2026-10-10T07:00:00.000Z', {
        make: 'Artega',
        model: 'GT',
        family: 'allemandes',
        status: 'contacte',
      });
      const before = repository.vehicle(vehicleId);

      // When
      repository.applyRegrouping(vehicleId, { make: 'Artega', model: null });

      // Then
      expect(repository.vehicle(vehicleId)).toEqual({ ...before, model: null });
    });

    it('la réévaluation après le passage de la zone à Libourne, rayon 30 km, écarte la Ferrari de Langon déjà contactée, qui reste « contactée »', () => {
      // Given
      const repository = create();
      const { vehicleId } = storeFirstSighting(repository, FERRARI_360, '2026-10-12T07:00:00.000Z', {
        status: 'contacte',
        note: 'Visite prévue jeudi',
      });
      const before = repository.vehicle(vehicleId);
      const fromLibourne = haversineKm({ lat: 44.915, lon: -0.2436 }, { lat: 44.5547, lon: -0.2497 });

      // When
      repository.applyReevaluation(vehicleId, {
        matched: false,
        rejections: [{ kind: 'outsideRadius', distanceKm: fromLibourne, radiusKm: 30 }],
        distanceKm: fromLibourne,
        make: 'Ferrari',
        model: '360 Modena',
        family: 'italiennes',
      });

      // Then
      expect(repository.vehicle(vehicleId)).toEqual({
        ...before,
        matched: false,
        rejections: [{ kind: 'outsideRadius', distanceKm: fromLibourne, radiusKm: 30 }],
        distanceKm: fromLibourne,
        make: 'Ferrari',
        model: '360 Modena',
        family: 'italiennes',
      });
    });

    it('l’enregistrement des réglages qui ajoutent Artega aux allemandes reclasse l’Artega GT : marque, modèle, famille et verdict sont réécrits', () => {
      // Given
      const repository = create();
      const { vehicleId } = storeFirstSighting(repository, ARTEGA_GT, '2026-10-12T07:00:00.000Z', {
        make: null,
        model: null,
        family: 'autres',
        matched: false,
        rejections: [{ kind: 'unknownBrand' }],
      });
      const before = repository.vehicle(vehicleId);

      // When
      repository.applyReevaluation(vehicleId, {
        matched: true,
        rejections: [],
        distanceKm: before?.distanceKm ?? null,
        make: 'Artega',
        model: 'GT',
        family: 'allemandes',
      });

      // Then
      expect(repository.vehicle(vehicleId)).toEqual({
        ...before,
        matched: true,
        rejections: [],
        make: 'Artega',
        model: 'GT',
        family: 'allemandes',
      });
    });

    it('« Ne plus contacter » change le statut et le drapeau de l’Alpine, sa note et son message retouché restent', () => {
      // Given
      const repository = create();
      const { vehicleId } = storeFirstSighting(repository, ALPINE_A110, '2026-10-12T07:00:00.000Z', {
        status: 'contacte',
        note: 'Rappeler après 18 h',
        messageOverride: 'Bonjour, votre Alpine A110 Légende m’intéresse.',
      });
      const before = repository.vehicle(vehicleId);

      // When
      repository.applyVehicleUpdate(vehicleId, { doNotContact: true, status: 'ignore' });

      // Then
      expect(repository.vehicle(vehicleId)).toEqual({ ...before, doNotContact: true, status: 'ignore' });
    });

    it('la note et le message retouché de l’Alpine sont enregistrés, puis effacés quand le concessionnaire vide les deux champs', () => {
      // Given
      const repository = create();
      const { vehicleId } = storeFirstSighting(repository, ALPINE_A110, '2026-10-12T07:00:00.000Z', { status: 'contacte' });
      const before = repository.vehicle(vehicleId);
      const note = 'Rappeler après 18 h';
      const messageOverride = 'Bonjour, votre Alpine A110 Légende m’intéresse.';

      // When
      repository.applyVehicleUpdate(vehicleId, { note, messageOverride });
      const written = repository.vehicle(vehicleId);
      repository.applyVehicleUpdate(vehicleId, { note: null, messageOverride: null });

      // Then
      expect(written).toEqual({ ...before, note, messageOverride });
      expect(repository.vehicle(vehicleId)).toEqual({ ...before, note: null, messageOverride: null });
    });

    it('« Garder quand même » la 911 (997) d’un professionnel : elle est retenue sans raison d’écart, le reste de la fiche ne bouge pas', () => {
      // Given
      const repository = create();
      const { vehicleId } = storeFirstSighting(repository, PORSCHE_997_PRO, '2026-10-12T07:00:00.000Z', {
        matched: false,
        rejections: [{ kind: 'professionalSeller' }, { kind: 'outsideRadius', distanceKm: 107.4, radiusKm: 100 }],
      });
      const before = repository.vehicle(vehicleId);

      // When
      repository.applyVehicleUpdate(vehicleId, { status: 'nouveau', matched: true, rejections: [] });

      // Then
      expect(repository.vehicle(vehicleId)).toEqual({ ...before, status: 'nouveau', matched: true, rejections: [] });
    });

    it('une notification envoyée pour la 911 est datée sur sa fiche', () => {
      // Given
      const repository = create();
      const { vehicleId } = storeFirstSighting(repository, PORSCHE_911_4S, '2026-10-13T07:02:11.000Z');
      const before = repository.vehicle(vehicleId);

      // When
      repository.markNotified(vehicleId, '2026-10-13T07:02:12.000Z');

      // Then
      expect(repository.vehicle(vehicleId)).toEqual({ ...before, notifiedAt: '2026-10-13T07:02:12.000Z' });
    });
  });

  describe('historique de la fiche', () => {
    it('les événements d’une fiche vont du plus récent au plus ancien ; les deux événements de « Garder quand même », notés au même instant, le dernier d’abord', () => {
      // Given
      const repository = create();
      const { vehicleId } = storeFirstSighting(repository, PORSCHE_997_PRO, '2026-10-09T06:10:00.000Z');
      repository.addEvent(vehicleId, { type: 'nouveau', detail: 'La Centrale', at: '2026-10-09T06:10:00.000Z' });

      // When
      repository.addEvent(vehicleId, { type: 'statut_nouveau', detail: null, at: '2026-10-13T12:31:09.000Z' });
      repository.addEvent(vehicleId, { type: 'garde_manuellement', detail: null, at: '2026-10-13T12:31:09.000Z' });

      // Then
      expect(repository.events(vehicleId).map(({ vehicleId: owner, type, detail, at }) => ({ owner, type, detail, at }))).toEqual([
        { owner: vehicleId, type: 'garde_manuellement', detail: null, at: '2026-10-13T12:31:09.000Z' },
        { owner: vehicleId, type: 'statut_nouveau', detail: null, at: '2026-10-13T12:31:09.000Z' },
        { owner: vehicleId, type: 'nouveau', detail: 'La Centrale', at: '2026-10-09T06:10:00.000Z' },
      ]);
    });

    it('l’événement d’un retour arrière est effacé et ne compte plus dans la semaine', () => {
      // Given
      const repository = create();
      const porsche = storeFirstSighting(repository, PORSCHE_911_4S, '2026-10-13T07:00:00.000Z', { status: 'contacte' });
      repository.addEvent(porsche.vehicleId, { type: 'nouveau', detail: 'Leboncoin', at: '2026-10-13T07:00:00.000Z' });
      repository.addEvent(porsche.vehicleId, { type: 'statut_contacte', detail: null, at: '2026-10-13T09:30:00.000Z' });
      const alpine = storeFirstSighting(repository, ALPINE_A110, '2026-10-12T07:00:00.000Z', { status: 'contacte' });
      repository.addEvent(alpine.vehicleId, { type: 'statut_contacte', detail: null, at: '2026-10-12T15:00:00.000Z' });

      // When
      repository.eraseEvents(porsche.vehicleId, ['statut_contacte', 'statut_repondu']);

      // Then
      expect(repository.activitySince(WEEK_START).contacted).toBe(1);
      expect(repository.enteredStatusAt(porsche.vehicleId, 'statut_contacte')).toBeNull();
      expect(repository.enteredStatusAt(alpine.vehicleId, 'statut_contacte')).toBe('2026-10-12T15:00:00.000Z');
      expect(repository.events(porsche.vehicleId).map((event) => event.type)).toEqual(['nouveau']);
    });

    it('une 911 recontactée après une réponse annulée est « contactée » depuis son dernier contact, pas depuis le premier', () => {
      // Given
      const repository = create();
      const { vehicleId } = storeFirstSighting(repository, PORSCHE_911_4S, '2026-10-05T07:00:00.000Z', { status: 'contacte' });
      repository.addEvent(vehicleId, { type: 'statut_contacte', detail: null, at: '2026-10-06T09:05:00.000Z' });

      // When
      repository.addEvent(vehicleId, { type: 'statut_contacte', detail: null, at: '2026-10-12T18:00:00.000Z' });

      // Then
      expect(repository.enteredStatusAt(vehicleId, 'statut_contacte')).toBe('2026-10-12T18:00:00.000Z');
      expect(repository.enteredStatusAt(vehicleId, 'statut_repondu')).toBeNull();
    });
  });

  describe('l’écran Annonces, par pages', () => {
    it('les annonces retenues à traiter vont de la plus récemment mise en ligne à la plus ancienne, une annonce sans date de mise en ligne prenant sa date d’arrivée', () => {
      // Given
      const repository = create();
      const porsche = storeFirstSighting(
        repository,
        { ...PORSCHE_911_4S, publishedAt: '2026-10-12T10:00:00.000Z' },
        '2026-10-13T07:00:00.000Z',
      );
      const mercedes = storeFirstSighting(repository, MERCEDES_C63, '2026-10-12T18:00:00.000Z', { matched: true, rejections: [] });
      const ferrari = storeFirstSighting(
        repository,
        { ...FERRARI_360, publishedAt: '2026-10-12T06:00:00.000Z' },
        '2026-10-13T07:05:00.000Z',
      );
      storeFirstSighting(repository, MUSTANG_GT, '2026-10-13T08:00:00.000Z', { status: 'contacte' });
      storeFirstSighting(repository, BMW_M3_E46, '2026-10-13T08:10:00.000Z', {
        matched: false,
        rejections: [{ kind: 'mileageAbove', km: 128000, maxKm: 100000 }],
      });

      // When
      const page = repository.page({ selection: NOUVEAU, limit: 50 });

      // Then
      expect(page.vehicles.map((vehicle) => vehicle.id)).toEqual(ids([mercedes, porsche, ferrari]));
      expect(page.nextCursor).toBeUndefined();
    });

    it('la page suivante reprend après la dernière annonce vue même si deux annonces ont la même date', () => {
      // Given
      const repository = create();
      const sameEmail = '2026-10-13T06:58:03.000Z';
      const porsche = storeFirstSighting(repository, PORSCHE_911_4S, '2026-10-12T07:00:00.000Z');
      const alpine = storeFirstSighting(repository, { ...ALPINE_A110, publishedAt: sameEmail }, '2026-10-13T07:00:00.000Z');
      const corvette = storeFirstSighting(repository, { ...CORVETTE_C7, publishedAt: sameEmail }, '2026-10-13T07:00:01.000Z');

      // When
      const first = repository.page({ selection: NOUVEAU, limit: 1 });
      const second = repository.page({ selection: NOUVEAU, after: first.nextCursor, limit: 1 });
      const third = repository.page({ selection: NOUVEAU, after: second.nextCursor, limit: 1 });

      // Then
      expect([...first.vehicles, ...second.vehicles, ...third.vehicles].map((vehicle) => vehicle.id)).toEqual(
        ids([corvette, alpine, porsche]),
      );
      expect(first.nextCursor).toEqual({ sortAt: sameEmail, id: corvette.vehicleId });
      expect(second.nextCursor).toEqual({ sortAt: sameEmail, id: alpine.vehicleId });
      expect(third.nextCursor).toBeUndefined();
    });

    it('« Tous » montre les annonces retenues de tous les statuts, jamais les écartées', () => {
      // Given
      const repository = create();
      const porsche = storeFirstSighting(repository, PORSCHE_911_4S, '2026-10-13T07:00:00.000Z');
      const mustang = storeFirstSighting(repository, MUSTANG_GT, '2026-10-12T07:00:00.000Z', { status: 'contacte' });
      const peugeot = storeFirstSighting(repository, PEUGEOT_205_GTI, '2026-10-11T07:00:00.000Z', {
        status: 'repondu',
        matched: true,
        rejections: [],
      });
      const corvette = storeFirstSighting(repository, CORVETTE_C7, '2026-10-10T07:00:00.000Z', { status: 'ignore' });
      storeFirstSighting(repository, BMW_M3_E46, '2026-10-13T08:10:00.000Z', {
        matched: false,
        rejections: [{ kind: 'mileageAbove', km: 128000, maxKm: 100000 }],
      });

      // When
      const page = repository.page({ selection: { kind: 'kept' }, limit: 50 });

      // Then
      expect(page.vehicles.map((vehicle) => vehicle.id)).toEqual(ids([porsche, mustang, peugeot, corvette]));
    });

    it('« Tous » sur les 3 derniers jours ne montre que les annonces retenues arrivées depuis, quel que soit leur statut', () => {
      // Given
      const repository = create();
      const porsche = storeFirstSighting(repository, PORSCHE_911_4S, '2026-10-13T07:00:00.000Z');
      storeFirstSighting(repository, MUSTANG_GT, '2026-10-11T07:00:00.000Z', { status: 'contacte' });
      const corvette = storeFirstSighting(repository, CORVETTE_C7, '2026-10-12T09:00:00.000Z', { status: 'ignore' });
      storeFirstSighting(repository, BMW_M3_E46, '2026-10-13T08:10:00.000Z', {
        matched: false,
        rejections: [{ kind: 'mileageAbove', km: 128000, maxKm: 100000 }],
      });

      // When
      const page = repository.page({ selection: { kind: 'kept' }, firstSeenSince: THREE_DAYS_AGO, limit: 50 });

      // Then
      expect(page.vehicles.map((vehicle) => vehicle.id)).toEqual(ids([porsche, corvette]));
    });

    it('les écartées des 14 derniers jours se filtrent par groupe de raison, avec ou sans les marques non suivies', () => {
      // Given
      const repository = create();
      const { mazda, toyota, audi, bmw, porsche997 } = rejectedOfTheFortnight(repository);
      const rejected = (selection: VehicleSelection): readonly number[] =>
        repository.page({ selection, firstSeenSince: FORTNIGHT_START, limit: 50 }).vehicles.map((vehicle) => vehicle.id);

      // When
      const groups = {
        all: rejected({ kind: 'rejected' }),
        withoutBrands: rejected({ kind: 'rejected', withoutGroup: 'marque' }),
        marque: rejected({ kind: 'rejected', withGroup: 'marque' }),
        special: rejected({ kind: 'rejected', withGroup: 'special' }),
        pro: rejected({ kind: 'rejected', withGroup: 'pro' }),
        km: rejected({ kind: 'rejected', withGroup: 'km' }),
        loin: rejected({ kind: 'rejected', withGroup: 'loin' }),
      };

      // Then
      expect(groups).toEqual({
        all: ids([mazda, toyota, audi, bmw, porsche997]),
        withoutBrands: ids([audi, bmw, porsche997]),
        marque: ids([mazda, toyota]),
        special: ids([audi]),
        pro: ids([porsche997]),
        km: ids([bmw]),
        loin: ids([porsche997]),
      });
    });

    it('une Audi A3 écartée il y a trois semaines n’est plus parmi les écartées des 14 derniers jours', () => {
      // Given
      const repository = create();
      rejectedOfTheFortnight(repository);

      // When
      const special = repository.page({
        selection: { kind: 'rejected', withGroup: 'special' },
        firstSeenSince: FORTNIGHT_START,
        limit: 50,
      });
      const everySpecial = repository.page({ selection: { kind: 'rejected', withGroup: 'special' }, limit: 50 });

      // Then
      expect(special.vehicles.map((vehicle) => vehicle.firstSeenAt)).toEqual(['2026-10-11T08:15:00.000Z']);
      expect(everySpecial.vehicles.map((vehicle) => vehicle.firstSeenAt)).toEqual(['2026-10-11T08:15:00.000Z', '2026-09-24T07:40:00.000Z']);
    });

    it('les écartées des 14 derniers jours sont comptées par groupe, sans l’Audi de la semaine d’avant, la 911 (997) d’un professionnel à Angoulême comptant chez les pros et chez les trop loin', () => {
      // Given
      const repository = create();
      rejectedOfTheFortnight(repository);

      // When
      const counts = repository.rejectedCounts(FORTNIGHT_START);

      // Then
      expect(counts).toEqual({ all: 5, byGroup: { marque: 2, special: 1, pro: 1, km: 1, loin: 1 } });
    });
  });

  describe('l’accueil et la semaine', () => {
    it('les compteurs des onglets ne comptent que les annonces retenues, statut par statut', () => {
      // Given
      const repository = create();
      storeFirstSighting(repository, PORSCHE_911_4S, '2026-10-13T07:00:00.000Z');
      storeFirstSighting(repository, FERRARI_360, '2026-10-13T07:05:00.000Z');
      storeFirstSighting(repository, MUSTANG_GT, '2026-10-12T07:00:00.000Z', { status: 'contacte' });
      storeFirstSighting(repository, PEUGEOT_205_GTI, '2026-10-11T07:00:00.000Z', { status: 'repondu', matched: true, rejections: [] });
      storeFirstSighting(repository, CORVETTE_C7, '2026-10-10T07:00:00.000Z', { status: 'ignore' });
      storeFirstSighting(repository, AUDI_A3, '2026-10-13T08:00:00.000Z', { matched: false, rejections: [{ kind: 'notSpecial' }] });

      // When
      const counts = repository.countsByStatus();

      // Then
      expect(counts).toEqual({ nouveau: 2, contacte: 1, repondu: 1, ignore: 1 });
    });

    it('la ligne des 7 derniers jours compte les annonces retenues arrivées, les vendeurs contactés et les réponses, d’après les événements', () => {
      // Given
      const repository = create();
      storeFirstSighting(repository, PORSCHE_911_4S, '2026-10-13T07:00:00.000Z');
      storeFirstSighting(repository, FERRARI_360, '2026-10-02T07:00:00.000Z');
      storeFirstSighting(repository, BMW_M3_E46, '2026-10-12T07:00:00.000Z', {
        matched: false,
        rejections: [{ kind: 'mileageAbove', km: 128000, maxKm: 100000 }],
      });
      const mustang = storeFirstSighting(repository, MUSTANG_GT, '2026-09-30T07:00:00.000Z', { status: 'contacte' });
      repository.addEvent(mustang.vehicleId, { type: 'statut_contacte', detail: null, at: '2026-10-13T09:00:00.000Z' });
      repository.addEvent(mustang.vehicleId, { type: 'statut_contacte', detail: null, at: '2026-10-14T17:00:00.000Z' });
      const alpine = storeFirstSighting(repository, ALPINE_A110, '2026-09-30T07:10:00.000Z', { status: 'repondu' });
      repository.addEvent(alpine.vehicleId, { type: 'statut_contacte', detail: null, at: '2026-10-01T10:00:00.000Z' });
      repository.addEvent(alpine.vehicleId, { type: 'statut_repondu', detail: null, at: '2026-10-12T14:22:00.000Z' });

      // When
      const week = repository.activitySince(WEEK_START);

      // Then
      expect(week).toEqual({ received: 1, contacted: 1, replied: 1 });
    });

    it('comportement hérité : une Alpine passée en « contactée » sans événement n’est pas comptée parmi les contacts de la semaine', () => {
      // Given
      const repository = create();
      storeFirstSighting(repository, ALPINE_A110, '2026-09-30T07:00:00.000Z', { status: 'contacte' });

      // When
      const week = repository.activitySince(WEEK_START);

      // Then
      expect(week.contacted).toBe(0);
    });
  });

  describe('réévaluation et réparation', () => {
    it('la réévaluation porte sur les voitures arrivées depuis 7 jours, retenues ou écartées, quel que soit leur statut, les plus récentes d’abord', () => {
      // Given
      const repository = create();
      const porsche = storeFirstSighting(repository, PORSCHE_911_4S, '2026-10-13T07:00:00.000Z');
      const bmw = storeFirstSighting(repository, BMW_M3_E46, '2026-10-12T07:00:00.000Z', {
        matched: false,
        rejections: [{ kind: 'mileageAbove', km: 128000, maxKm: 100000 }],
      });
      const mustang = storeFirstSighting(repository, MUSTANG_GT, '2026-10-10T07:00:00.000Z', { status: 'contacte' });
      storeFirstSighting(repository, FERRARI_360, '2026-10-02T07:00:00.000Z');

      // When
      const recent = repository.vehiclesFirstSeenSince(WEEK_START);

      // Then
      expect(recent.map((vehicle) => vehicle.id)).toEqual(ids([porsche, bmw, mustang]));
    });

    it('deux annonces importées dans la même milliseconde : la réévaluation les reprend dans l’ordre de leur enregistrement', () => {
      // Given
      const repository = create();
      const sameImport = '2026-10-13T07:00:00.731Z';
      const porsche = storeFirstSighting(repository, PORSCHE_911_4S, sameImport);
      const ferrari = storeFirstSighting(repository, FERRARI_360, sameImport);
      const mustang = storeFirstSighting(repository, MUSTANG_GT, '2026-10-12T07:00:00.000Z');

      // When
      const recent = repository.vehiclesFirstSeenSince(WEEK_START);

      // Then
      expect(recent.map((vehicle) => vehicle.id)).toEqual(ids([porsche, ferrari, mustang]));
    });

    it('la réparation parcourt toutes les voitures dans l’ordre de leur enregistrement', () => {
      // Given
      const repository = create();
      const porsche = storeFirstSighting(repository, PORSCHE_911_4S, '2026-10-13T07:00:00.000Z');
      const deleted = storeFirstSighting(repository, MERCEDES_C63, '2026-09-20T07:00:00.000Z');
      const ferrari = storeFirstSighting(repository, FERRARI_360, '2026-10-02T07:00:00.000Z', { status: 'ignore' });
      repository.deleteVehicle(deleted.vehicleId);

      // When
      const all = repository.allVehicles();

      // Then
      expect(all.map((vehicle) => vehicle.id)).toEqual(ids([porsche, ferrari]));
    });
  });
}
