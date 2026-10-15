import { describe, expect, it } from 'vitest';
import { type Regrouping, regroupListings, vehicleOfSeparatedListings } from '../../../src/domain/ingest/regroup.js';
import { extractionContextAt } from '../../../src/domain/parsing/extractionContext.js';
import { extractVehicleInfo } from '../../../src/domain/parsing/vehicleInfo.js';
import { defaultSettings } from '../../../src/domain/settings/defaults.js';
import type { Settings } from '../../../src/domain/settings/types.js';
import { fingerprint } from '../../../src/domain/vehicle/identity.js';
import type { Listing, Vehicle } from '../../../src/domain/vehicle/types.js';
import { FIRST_READ_AT, knownListing, knownVehicle, PESSAC } from '../../support/knownVehicle.js';
import { rawListing } from '../../support/rawListing.js';

const settings = defaultSettings();
const REPAIRED_AT = '2026-10-15T08:30:00.000Z';
const MERGED_AT = '2026-10-09T17:45:00.000Z';

const fingerprintOf = (listing: Listing, rules: Settings = settings): string => {
  const raw = rawListing(listing.title, { year: listing.year ?? undefined, postalCode: listing.postalCode ?? undefined });
  return fingerprint(extractVehicleInfo(raw, extractionContextAt(rules, REPAIRED_AT)), raw);
};

const repaired = (vehicle: Vehicle, listings: readonly Listing[], rules: Settings = settings): Regrouping => {
  const regrouping = regroupListings(vehicle, listings, rules, extractionContextAt(rules, REPAIRED_AT));
  if (regrouping === undefined) {
    throw new Error('aucune annonce à relire');
  }
  return regrouping;
};

const raptorListing = knownListing({
  id: 1,
  externalId: '2811001000',
  url: 'https://www.leboncoin.fr/ad/voitures/2811001000',
  title: 'Ford Autres - Ford ranger raptor',
  price: 61900,
  km: 46000,
  year: 2024,
});

const mustangLeboncoin = knownListing({
  id: 2,
  externalId: '2811001001',
  url: 'https://www.leboncoin.fr/ad/voitures/2811001001',
  title: 'Ford Autres - Ford Mustang GT',
  price: 54000,
  km: 45000,
  year: 2024,
  publishedAt: '2026-10-09T08:00:00.000Z',
  firstSeenAt: MERGED_AT,
  lastSeenAt: MERGED_AT,
});

const fordOfAnOlderVersion = knownVehicle({
  fingerprint: fingerprint(
    { make: 'Ford', model: 'Autres', family: 'americaines', year: 2024 },
    { title: raptorListing.title, postalCode: '33600' },
  ),
  make: 'Ford',
  model: 'Autres',
  family: 'americaines',
  year: 2024,
  km: 46000,
  price: 61900,
});

describe('réparation : un véhicule relu avec les règles du jour', () => {
  it('la Ford « Autres » enregistrée par une ancienne version devient un ranger raptor, avec son empreinte du jour', () => {
    // Given
    const listings = [raptorListing];

    // When
    const regrouping = repaired(fordOfAnOlderVersion, listings);

    // Then
    expect(regrouping).toEqual({
      vehicleChanges: { make: 'Ford', model: 'ranger raptor', fingerprint: fingerprintOf(raptorListing) },
      renamed: true,
      reevaluated: false,
      separated: [],
    });
  });

  it('la Mustang fusionnée à tort avec le ranger raptor en ressort, et la Ford perd son étiquette « Republiée »', () => {
    // Given
    const vehicle = { ...fordOfAnOlderVersion, reposted: true };

    // When
    const regrouping = repaired(vehicle, [raptorListing, mustangLeboncoin]);

    // Then
    expect(regrouping.vehicleChanges).toMatchObject({ model: 'ranger raptor', reposted: false });
    expect(regrouping.separated.map((group) => group.listings.map((listing) => listing.id))).toEqual([[2]]);
  });

  it('la Mustang séparée devient une voiture à traiter, jugée sur ses propres données, avec l’événement « nouveau » de sa première lecture', () => {
    // Given
    const [group] = repaired(fordOfAnOlderVersion, [raptorListing, mustangLeboncoin]).separated;
    if (group === undefined) {
      throw new Error('la Mustang aurait dû être séparée');
    }

    // When
    const separated = vehicleOfSeparatedListings(group, PESSAC, settings);

    // Then
    expect(separated).toEqual({
      vehicle: {
        fingerprint: fingerprintOf(mustangLeboncoin),
        make: 'Ford',
        model: 'Mustang GT',
        family: 'americaines',
        year: 2024,
        km: 45000,
        price: 54000,
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
        firstSeenAt: MERGED_AT,
        lastSeenAt: MERGED_AT,
        publishedAt: '2026-10-09T08:00:00.000Z',
        notifiedAt: null,
        priceDropped: false,
        reposted: false,
      },
      listingIds: [2],
      event: { type: 'nouveau', detail: 'Leboncoin', at: MERGED_AT },
    });
  });

  it('une deuxième passe sur la Ford réparée ne change rien', () => {
    // Given
    const first = repaired(fordOfAnOlderVersion, [raptorListing, mustangLeboncoin]);
    const fixedFord = { ...fordOfAnOlderVersion, ...first.vehicleChanges };

    // When
    const second = repaired(fixedFord, [raptorListing]);

    // Then
    expect(second).toEqual({ vehicleChanges: {}, renamed: false, reevaluated: false, separated: [] });
  });

  it('deux annonces de la même Mustang fusionnées à tort ressortent ensemble : la date de mise en ligne la plus ancienne et la dernière lecture la plus récente', () => {
    // Given
    const mustangLaCentrale = knownListing({
      id: 3,
      site: 'lacentrale',
      siteLabel: 'La Centrale',
      externalId: '69112345000',
      url: 'https://www.lacentrale.fr/auto-occasion-annonce-69112345000.html',
      title: 'Ford Autres - Ford Mustang GT',
      price: 53500,
      km: 45200,
      year: 2024,
      publishedAt: '2026-10-05T11:00:00.000Z',
      firstSeenAt: '2026-10-11T07:00:00.000Z',
      lastSeenAt: '2026-10-14T07:00:00.000Z',
    });
    const [group] = repaired(fordOfAnOlderVersion, [raptorListing, mustangLeboncoin, mustangLaCentrale]).separated;
    if (group === undefined) {
      throw new Error('la Mustang aurait dû être séparée');
    }

    // When
    const separated = vehicleOfSeparatedListings(group, PESSAC, settings);

    // Then
    expect(separated.listingIds).toEqual([2, 3]);
    expect(separated.vehicle).toMatchObject({
      firstSeenAt: MERGED_AT,
      lastSeenAt: '2026-10-14T07:00:00.000Z',
      publishedAt: '2026-10-05T11:00:00.000Z',
      reposted: false,
      price: 54000,
    });
  });

  it('deux Mustang GT de 2024 fusionnées à tort avec le ranger raptor, à 45 000 et 120 000 km, ressortent en deux voitures', () => {
    // Given
    const mustangAt120000Km = knownListing({
      id: 3,
      externalId: '2811001003',
      url: 'https://www.leboncoin.fr/ad/voitures/2811001003',
      title: 'Ford Autres - Ford Mustang GT',
      price: 38900,
      km: 120000,
      year: 2024,
      firstSeenAt: '2026-10-11T07:00:00.000Z',
    });

    // When
    const regrouping = repaired(fordOfAnOlderVersion, [raptorListing, mustangLeboncoin, mustangAt120000Km]);

    // Then
    expect(regrouping.separated.map((group) => group.listings.map((listing) => listing.id))).toEqual([[2], [3]]);
  });

  it('une Mustang republiée sur Leboncoin, fusionnée à tort avec le ranger raptor, ressort avec son étiquette « Republiée »', () => {
    // Given
    const mustangRepost = knownListing({
      id: 3,
      externalId: '2811001009',
      url: 'https://www.leboncoin.fr/ad/voitures/2811001009',
      title: 'Ford Autres - Ford Mustang GT',
      price: 52900,
      km: 45000,
      year: 2024,
      firstSeenAt: '2026-10-12T07:00:00.000Z',
      lastSeenAt: '2026-10-12T07:00:00.000Z',
    });
    const [group] = repaired(fordOfAnOlderVersion, [raptorListing, mustangLeboncoin, mustangRepost]).separated;
    if (group === undefined) {
      throw new Error('la Mustang aurait dû être séparée');
    }

    // When
    const separated = vehicleOfSeparatedListings(group, PESSAC, settings);

    // Then
    expect(separated.listingIds).toEqual([2, 3]);
    expect(separated.vehicle.reposted).toBe(true);
  });

  it('une Mustang lue sur La Centrale sans année ni lieu, fusionnée à tort avec le ranger raptor, ressort avec l’année, la ville et le code postal de la fiche d’origine', () => {
    // Given
    const mustangLaCentrale = knownListing({
      id: 2,
      site: 'lacentrale',
      siteLabel: 'La Centrale',
      externalId: '69112345000',
      url: 'https://www.lacentrale.fr/auto-occasion-annonce-69112345000.html',
      title: 'FORD MUSTANG GT',
      price: 53500,
      km: 45200,
      year: null,
      city: null,
      postalCode: null,
      firstSeenAt: MERGED_AT,
      lastSeenAt: MERGED_AT,
    });
    const [group] = repaired(fordOfAnOlderVersion, [raptorListing, mustangLaCentrale]).separated;
    if (group === undefined) {
      throw new Error('la Mustang aurait dû être séparée');
    }

    // When
    const separated = vehicleOfSeparatedListings(group, PESSAC, settings);

    // Then
    expect(separated.vehicle).toMatchObject({ make: 'Ford', model: 'MUSTANG GT', year: 2024, city: 'Pessac', postalCode: '33600' });
  });

  it('comportement hérité : la Mustang séparée du ranger raptor laisse sur la Ford le prix de 53 000 € et la date de mise en ligne qu’elle lui avait donnés', () => {
    // Given
    const mustangLoweredTo53000 = { ...mustangLeboncoin, price: 53000 };
    const fordWithMustangData = { ...fordOfAnOlderVersion, price: 53000, publishedAt: mustangLeboncoin.publishedAt };

    // When
    const regrouping = repaired(fordWithMustangData, [raptorListing, mustangLoweredTo53000]);

    // Then
    expect(regrouping.vehicleChanges).toEqual({ make: 'Ford', model: 'ranger raptor', fingerprint: fingerprintOf(raptorListing) });
    expect(regrouping.separated.map((group) => group.listings.map((listing) => listing.id))).toEqual([[2]]);
  });

  it('une Mustang et un Bronco fusionnés à tort avec le ranger raptor ressortent en deux voitures', () => {
    // Given
    const bronco = knownListing({
      id: 3,
      externalId: '2811001002',
      url: 'https://www.leboncoin.fr/ad/voitures/2811001002',
      title: 'Ford Autres - Ford Bronco Wildtrak',
      price: 69000,
      km: 18000,
      year: 2024,
      firstSeenAt: '2026-10-11T07:00:00.000Z',
    });

    // When
    const regrouping = repaired(fordOfAnOlderVersion, [raptorListing, mustangLeboncoin, bronco]);

    // Then
    expect(regrouping.separated.map((group) => group.listings.map((listing) => listing.id))).toEqual([[2], [3]]);
  });

  it('la 911 de La Centrale, lue sans kilométrage puis baissée à 79 900 €, reste sur la voiture : le kilométrage de la fiche la départage', () => {
    // Given
    const leboncoin = knownListing();
    const laCentrale = knownListing({
      id: 2,
      site: 'lacentrale',
      siteLabel: 'La Centrale',
      externalId: '69112345678',
      url: 'https://www.lacentrale.fr/auto-occasion-annonce-69112345678.html',
      title: 'PORSCHE 911 CARRERA S PDK',
      price: 79900,
      km: null,
      firstSeenAt: '2026-10-10T07:00:00.000Z',
    });

    // When
    const regrouping = repaired(knownVehicle(), [leboncoin, laCentrale]);

    // Then
    expect(regrouping).toEqual({ vehicleChanges: {}, renamed: false, reevaluated: false, separated: [] });
  });

  it('la 911 lue d’abord sur Leboncoin sans kilométrage, complétée à la relecture, puis vue sur La Centrale à 79 900 € reste sur la voiture : le kilométrage de la fiche départage', () => {
    // Given
    const leboncoinWithoutKm = knownListing({ title: 'Porsche 911 Carrera S 2015 89 900 €', km: null });
    const laCentrale = knownListing({
      id: 2,
      site: 'lacentrale',
      siteLabel: 'La Centrale',
      externalId: '69112345678',
      url: 'https://www.lacentrale.fr/auto-occasion-annonce-69112345678.html',
      title: 'PORSCHE 911 CARRERA S PDK',
      price: 79900,
      km: 43000,
      firstSeenAt: '2026-10-10T07:00:00.000Z',
    });

    // When
    const regrouping = repaired(knownVehicle({ km: 42000 }), [leboncoinWithoutKm, laCentrale]);

    // Then
    expect(regrouping).toEqual({ vehicleChanges: {}, renamed: false, reevaluated: false, separated: [] });
  });

  it('l’annonce La Centrale d’une 911, lue comme dans ses emails sans année ni lieu, reste sur la voiture : l’année et le code postal de la fiche complètent sa lecture', () => {
    // Given
    const leboncoin = knownListing();
    const laCentrale = knownListing({
      id: 2,
      site: 'lacentrale',
      siteLabel: 'La Centrale',
      externalId: '69112345678',
      url: 'https://www.lacentrale.fr/auto-occasion-annonce-69112345678.html',
      title: 'PORSCHE 911 CARRERA S PDK',
      price: 88500,
      km: 43000,
      year: null,
      city: null,
      postalCode: null,
      firstSeenAt: '2026-10-10T07:00:00.000Z',
    });

    // When
    const regrouping = repaired(knownVehicle(), [leboncoin, laCentrale]);

    // Then
    expect(regrouping).toEqual({ vehicleChanges: {}, renamed: false, reevaluated: false, separated: [] });
  });

  it('une 911 republiée sur Leboncoin sous un nouvel id garde son étiquette « Republiée » à la réparation', () => {
    // Given
    const first = knownListing();
    const repost = knownListing({
      id: 2,
      externalId: '2811004321',
      url: 'https://www.leboncoin.fr/ad/voitures/2811004321',
      price: 87900,
      firstSeenAt: '2026-10-12T07:00:00.000Z',
    });

    // When
    const regrouping = repaired(knownVehicle({ reposted: true }), [first, repost]);

    // Then
    expect(regrouping).toEqual({ vehicleChanges: {}, renamed: false, reevaluated: false, separated: [] });
  });

  it('une 911 contactée, devenue « trop de kilomètres » avec un plafond abaissé à 100 000 km, garde son statut et son verdict', () => {
    // Given
    const listing = knownListing({ title: 'Porsche 911 Carrera S 2015 142 000 km 59 900 €', km: 142000, price: 59900 });
    const vehicle = knownVehicle({
      fingerprint: fingerprintOf(listing),
      km: 142000,
      price: 59900,
      status: 'contacte',
      matched: true,
      rejections: [],
    });

    // When
    const regrouping = repaired(vehicle, [listing]);

    // Then
    expect(regrouping).toEqual({ vehicleChanges: {}, renamed: false, reevaluated: false, separated: [] });
  });

  it('une 911 à traiter, écartée à 120 000 km avant que le plafond passe à 150 000 km, est retenue par la réparation', () => {
    // Given
    const rules = { ...settings, maxKm: 150000 };
    const listing = knownListing({ title: 'Porsche 911 Carrera S 2015 120 000 km 64 900 €', km: 120000, price: 64900 });
    const vehicle = knownVehicle({
      fingerprint: fingerprintOf(listing),
      km: 120000,
      price: 64900,
      matched: false,
      rejections: [{ kind: 'mileageAbove', km: 120000, maxKm: 100000 }],
    });

    // When
    const regrouping = repaired(vehicle, [listing], rules);

    // Then
    expect(regrouping).toEqual({ vehicleChanges: { matched: true, rejections: [] }, renamed: false, reevaluated: true, separated: [] });
  });

  it('une 911 de Montauban géocodée à 180,03 km, déjà écartée « à 180 km » : la même raison relue n’est pas une réévaluation', () => {
    // Given
    const listing = knownListing({ city: 'Montauban', postalCode: '82000' });
    const vehicle = knownVehicle({
      fingerprint: fingerprintOf(listing),
      city: 'Montauban',
      postalCode: '82000',
      lat: 44.0176,
      lon: 1.3756,
      distanceKm: 180.02914454030503,
      matched: false,
      rejections: [{ kind: 'outsideRadius', distanceKm: 180, radiusKm: 100 }],
    });

    // When
    const regrouping = repaired(vehicle, [listing]);

    // Then
    expect(regrouping).toEqual({ vehicleChanges: {}, renamed: false, reevaluated: false, separated: [] });
  });

  it('comportement hérité : une Clio gardée à la main mais pas encore contactée repasse parmi les écartées à la réparation', () => {
    // Given
    const listing = knownListing({ title: 'Renault Clio 1.2 2016 60 000 km 7 500 €', km: 60000, price: 7500, year: 2016 });
    const keptClio = knownVehicle({
      fingerprint: fingerprintOf(listing),
      make: 'Renault',
      model: 'Clio',
      family: 'francaises',
      year: 2016,
      km: 60000,
      price: 7500,
      status: 'nouveau',
      matched: true,
      rejections: [],
    });

    // When
    const regrouping = repaired(keptClio, [listing]);

    // Then
    expect(regrouping).toEqual({
      vehicleChanges: { matched: false, rejections: [{ kind: 'notSpecial' }] },
      renamed: false,
      reevaluated: true,
      separated: [],
    });
  });

  it('une 911 à 142 000 km mise en « ne plus contacter », écartée quand le plafond est passé à 100 000 km puis gardée quand même : la réparation ne recalcule pas son verdict', () => {
    // Given
    const listing = knownListing({ title: 'Porsche 911 Carrera S 2015 142 000 km 59 900 €', km: 142000, price: 59900 });
    const keptAfterDoNotContact = knownVehicle({
      fingerprint: fingerprintOf(listing),
      km: 142000,
      price: 59900,
      status: 'nouveau',
      doNotContact: true,
      matched: true,
      rejections: [],
    });

    // When
    const regrouping = repaired(keptAfterDoNotContact, [listing]);

    // Then
    expect(regrouping).toEqual({ vehicleChanges: {}, renamed: false, reevaluated: false, separated: [] });
  });

  it('une Artega ajoutée à la main aux allemandes puis retirée des réglages : la réparation garde la marque et la famille, mais plus le modèle', () => {
    // Given
    const withArtega: Settings = {
      ...settings,
      families: {
        ...settings.families,
        allemandes: {
          ...settings.families.allemandes,
          brands: [...settings.families.allemandes.brands, 'Artega'],
          known: [...settings.families.allemandes.known, 'Artega'],
        },
      },
    };
    const listing = knownListing({ title: 'Artega GT 2009 28 000 km 42 000 €', km: 28000, price: 42000, year: 2009 });
    const artega = knownVehicle({
      fingerprint: fingerprintOf(listing, withArtega),
      make: 'Artega',
      model: 'GT',
      family: 'allemandes',
      year: 2009,
      km: 28000,
      price: 42000,
      status: 'contacte',
    });

    // When
    const regrouping = repaired(artega, [listing]);

    // Then
    expect(regrouping).toEqual({
      vehicleChanges: { make: 'Artega', model: null, fingerprint: fingerprintOf(listing) },
      renamed: true,
      reevaluated: false,
      separated: [],
    });
  });

  it('un véhicule resté sans annonce après une écriture interrompue n’est pas touché par la réparation', () => {
    // Given
    const orphan = knownVehicle({ firstSeenAt: FIRST_READ_AT });

    // When
    const regrouping = regroupListings(orphan, [], settings, extractionContextAt(settings, REPAIRED_AT));

    // Then
    expect(regrouping).toBeUndefined();
  });
});
