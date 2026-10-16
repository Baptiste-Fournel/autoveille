import { describe, expect, it } from 'vitest';
import type { VehicleCursor } from '../../../src/application/ports/vehicleRepository.js';
import { listVehicles, type VehicleList } from '../../../src/application/vehicles/listVehicles.js';
import { updateVehicle } from '../../../src/application/vehicles/updateVehicle.js';
import type { VehicleCard } from '../../../src/application/vehicles/vehicleCard.js';
import type { RejectionReason } from '../../../src/domain/filtering/verdict.js';
import type { RawListing } from '../../../src/domain/vehicle/types.js';
import {
  ALPINE_A110,
  AUDI_A3,
  BMW_M3_E46,
  CORVETTE_C7,
  FERRARI_360,
  MAZDA_5,
  MERCEDES_C63,
  MUSTANG_GT,
  PEUGEOT_205_GTI,
  PORSCHE_911_4S,
  PORSCHE_997_PRO,
  storeFirstSighting,
  TOYOTA_GR_YARIS,
} from '../../contracts/vehicleSamples.js';
import { fakeClock } from '../../fakes/fakeClock.js';
import { fakePersistence } from '../../fakes/fakePersistence.js';

const KEPT = { matched: true, rejections: [] } as const;

const world = () => ({ ...fakePersistence(), clock: fakeClock() });

const idsOf = (list: VehicleList): readonly number[] => list.vehicles.map((card: VehicleCard) => card.vehicle.id);

const repostedAs = (raw: RawListing, externalId: string): RawListing => ({
  ...raw,
  externalId,
  url: raw.url.replace(raw.externalId, externalId),
});

describe('l’écran Annonces, onglet par onglet', () => {
  it('l’écran Annonces liste les annonces retenues à traiter, la plus récemment mise en ligne en premier', () => {
    // Given
    const app = world();
    const ferrari = storeFirstSighting(app.vehicles, FERRARI_360, '2026-10-13T09:00:00.000Z', KEPT);
    const porsche = storeFirstSighting(app.vehicles, PORSCHE_911_4S, '2026-10-14T07:00:00.000Z', KEPT);
    const mustang = storeFirstSighting(app.vehicles, MUSTANG_GT, '2026-10-15T06:00:00.000Z', {
      ...KEPT,
      publishedAt: '2026-10-02T10:00:00.000Z',
    });
    storeFirstSighting(app.vehicles, ALPINE_A110, '2026-10-12T08:00:00.000Z', { ...KEPT, status: 'contacte' });
    storeFirstSighting(app.vehicles, BMW_M3_E46, '2026-10-14T08:00:00.000Z', {
      matched: false,
      rejections: [{ kind: 'mileageAbove', km: 128000, maxKm: 100000 }],
    });

    // When
    const list = listVehicles(app);

    // Then
    expect(idsOf(list)).toEqual([porsche.vehicleId, ferrari.vehicleId, mustang.vehicleId]);
    expect(list.nextCursor).toBeUndefined();
    expect(list.rejectedCounts).toBeUndefined();
  });

  it('un onglet inconnu (« vendu ») retombe sur les annonces à traiter', () => {
    // Given
    const app = world();
    const porsche = storeFirstSighting(app.vehicles, PORSCHE_911_4S, '2026-10-14T07:00:00.000Z', KEPT);
    storeFirstSighting(app.vehicles, ALPINE_A110, '2026-10-12T08:00:00.000Z', { ...KEPT, status: 'contacte' });

    // When
    const list = listVehicles(app, { status: 'vendu' });

    // Then
    expect(idsOf(list)).toEqual([porsche.vehicleId]);
  });

  it('l’onglet « Toutes » montre les annonces retenues quel que soit leur suivi, sans les écartées', () => {
    // Given
    const app = world();
    const porsche = storeFirstSighting(app.vehicles, PORSCHE_911_4S, '2026-10-14T07:00:00.000Z', KEPT);
    const alpine = storeFirstSighting(app.vehicles, ALPINE_A110, '2026-10-12T08:00:00.000Z', { ...KEPT, status: 'contacte' });
    const corvette = storeFirstSighting(app.vehicles, CORVETTE_C7, '2026-10-11T08:00:00.000Z', { ...KEPT, status: 'ignore' });
    storeFirstSighting(app.vehicles, MAZDA_5, '2026-10-13T07:02:00.000Z', {
      matched: false,
      rejections: [{ kind: 'unfollowedBrand', make: 'Mazda' }],
    });

    // When
    const list = listVehicles(app, { status: 'tous' });

    // Then
    expect(idsOf(list)).toEqual([porsche.vehicleId, alpine.vehicleId, corvette.vehicleId]);
  });

  it('limitée aux trois derniers jours, la liste laisse de côté la Corvette arrivée la semaine dernière', () => {
    // Given
    const app = world();
    const porsche = storeFirstSighting(app.vehicles, PORSCHE_911_4S, '2026-10-14T07:00:00.000Z', KEPT);
    const mustang = storeFirstSighting(app.vehicles, MUSTANG_GT, '2026-10-15T06:00:00.000Z', {
      ...KEPT,
      publishedAt: '2026-10-02T10:00:00.000Z',
    });
    storeFirstSighting(app.vehicles, CORVETTE_C7, '2026-10-08T08:00:00.000Z', KEPT);

    // When
    const list = listVehicles(app, { days: 3 });

    // Then
    expect(idsOf(list)).toEqual([porsche.vehicleId, mustang.vehicleId]);
  });

  it('la carte de l’Alpine contactée il y a trois jours donne la date du contact, sans réponse pour l’instant', () => {
    // Given
    const app = world();
    const alpine = storeFirstSighting(app.vehicles, ALPINE_A110, '2026-10-11T08:00:00.000Z', KEPT);
    app.clock.set('2026-10-12T10:05:00.000Z');
    updateVehicle(app, alpine.vehicleId, { status: 'contacte' });
    app.clock.set('2026-10-15T08:30:00.000Z');

    // When
    const list = listVehicles(app, { status: 'contacte' });

    // Then
    expect(list.vehicles).toHaveLength(1);
    expect(list.vehicles[0]?.contactedAt).toBe('2026-10-12T10:05:00.000Z');
    expect(list.vehicles[0]?.repliedAt).toBeNull();
  });

  it('la carte de la Ferrari dont le vendeur a répondu donne la date du contact et celle de la réponse', () => {
    // Given
    const app = world();
    const ferrari = storeFirstSighting(app.vehicles, FERRARI_360, '2026-10-05T09:00:00.000Z', KEPT);
    app.clock.set('2026-10-06T17:40:00.000Z');
    updateVehicle(app, ferrari.vehicleId, { status: 'contacte' });
    app.clock.set('2026-10-13T11:20:00.000Z');
    updateVehicle(app, ferrari.vehicleId, { status: 'repondu' });

    // When
    const list = listVehicles(app, { status: 'repondu' });

    // Then
    expect(idsOf(list)).toEqual([ferrari.vehicleId]);
    expect(list.vehicles[0]?.contactedAt).toBe('2026-10-06T17:40:00.000Z');
    expect(list.vehicles[0]?.repliedAt).toBe('2026-10-13T11:20:00.000Z');
  });

  it('la Ferrari dont le vendeur a répondu puis a demandé à ne plus être contacté : sa carte parmi les ignorées ne donne plus ni contact ni réponse', () => {
    // Given
    const app = world();
    const ferrari = storeFirstSighting(app.vehicles, FERRARI_360, '2026-10-05T09:00:00.000Z', KEPT);
    app.clock.set('2026-10-06T17:40:00.000Z');
    updateVehicle(app, ferrari.vehicleId, { status: 'contacte' });
    app.clock.set('2026-10-13T11:20:00.000Z');
    updateVehicle(app, ferrari.vehicleId, { status: 'repondu' });
    updateVehicle(app, ferrari.vehicleId, { doNotContact: true });

    // When
    const list = listVehicles(app, { status: 'ignore' });

    // Then
    expect(idsOf(list)).toEqual([ferrari.vehicleId]);
    expect(list.vehicles[0]?.contactedAt).toBeNull();
    expect(list.vehicles[0]?.repliedAt).toBeNull();
  });

  it('la carte d’une 911 encore à traiter n’affiche ni contact ni réponse', () => {
    // Given
    const app = world();
    storeFirstSighting(app.vehicles, PORSCHE_911_4S, '2026-10-14T07:00:00.000Z', KEPT);

    // When
    const list = listVehicles(app);

    // Then
    expect(list.vehicles[0]?.contactedAt).toBeNull();
    expect(list.vehicles[0]?.repliedAt).toBeNull();
  });
});

describe('l’écran Annonces, par pages', () => {
  const MORNING_TITLES: readonly RawListing[] = [
    PORSCHE_911_4S,
    MERCEDES_C63,
    FERRARI_360,
    MUSTANG_GT,
    ALPINE_A110,
    CORVETTE_C7,
    PEUGEOT_205_GTI,
  ];

  const minutesAfterSix = (minutes: number): string => new Date(Date.parse('2026-10-15T06:00:00.000Z') + minutes * 60_000).toISOString();

  const allPagesOf = (app: ReturnType<typeof world>): readonly VehicleList[] => {
    const next = (after: VehicleCursor | undefined, pages: readonly VehicleList[]): readonly VehicleList[] => {
      const page = listVehicles(app, { after });
      const all = [...pages, page];
      return page.nextCursor === undefined || all.length > 5 ? all : next(page.nextCursor, all);
    };
    return next(undefined, []);
  };

  it('une matinée chargée : 120 annonces à traiter s’affichent en trois pages de 50, 50 et 20, sans doublon ni trou, même quand 40 d’entre elles ont été mises en ligne à la même minute', () => {
    // Given
    const app = world();
    const stored = Array.from({ length: 120 }, (_, index) => {
      const raw = MORNING_TITLES[index % MORNING_TITLES.length] ?? PORSCHE_911_4S;
      const publishedTheSameMinute = index % 3 === 0;
      return storeFirstSighting(app.vehicles, repostedAs(raw, `rafale-${index}`), minutesAfterSix(index), {
        ...KEPT,
        publishedAt: publishedTheSameMinute ? '2026-10-14T18:00:00.000Z' : null,
      });
    });

    // When
    const pages = allPagesOf(app);

    // Then
    expect(pages.map((page) => page.vehicles.length)).toEqual([50, 50, 20]);
    const shown = pages.flatMap(idsOf);
    expect(new Set(shown).size).toBe(120);
    expect([...shown].sort((a, b) => a - b)).toEqual(stored.map((sighting) => sighting.vehicleId));
    expect(pages.at(-1)?.nextCursor).toBeUndefined();
  });

  it('la page suivante reprend juste après la dernière carte de la page précédente', () => {
    // Given
    const app = world();
    const stored = Array.from({ length: 52 }, (_, index) =>
      storeFirstSighting(app.vehicles, repostedAs(PORSCHE_911_4S, `matin-${index}`), minutesAfterSix(index), KEPT),
    );
    const mostRecentFirst = stored.map((sighting) => sighting.vehicleId).reverse();

    // When
    const first = listVehicles(app);
    const second = listVehicles(app, { after: first.nextCursor });

    // Then
    expect(idsOf(first)).toEqual(mostRecentFirst.slice(0, 50));
    expect(idsOf(second)).toEqual(mostRecentFirst.slice(50));
  });
});

describe('« Écartées », groupées par raison', () => {
  const laCentraleDigestListing = (externalId: string, title: string, price: number, km: number): RawListing => ({
    site: 'lacentrale',
    siteLabel: 'La Centrale',
    externalId,
    url: `https://www.lacentrale.fr/auto-occasion-annonce-${externalId}.html`,
    title,
    price,
    km,
    city: 'Gironde (33)',
    postalCode: '33',
    sellerType: 'particulier',
  });

  const PORSCHE_911_AT_142000_KM: RawListing = {
    ...PORSCHE_911_4S,
    externalId: '2810770001',
    url: 'https://www.leboncoin.fr/ad/voitures/2810770001',
    title: 'Porsche 911 Carrera S 3.0 420ch PDK',
    price: 59900,
    km: 142000,
    year: 2015,
    city: 'Bègles',
    postalCode: '33130',
  };

  const MERCEDES_280_SL_FROM_A_DEALER: RawListing = {
    ...MERCEDES_C63,
    externalId: '69100000280',
    url: 'https://www.lacentrale.fr/auto-occasion-annonce-69100000280.html',
    title: 'Mercedes 280 SL Pagode',
    price: 95000,
    km: 85000,
    year: 1969,
    city: 'Bordeaux',
    postalCode: '33000',
    sellerType: 'pro',
  };

  const rejected = (rejections: readonly RejectionReason[]) => ({ matched: false, rejections });

  const rejectedOfTheFortnight = (app: ReturnType<typeof world>) => {
    storeFirstSighting(app.vehicles, repostedAs(AUDI_A3, '2810990001'), '2026-09-30T20:00:00.000Z', rejected([{ kind: 'notSpecial' }]));
    const porsche142000 = storeFirstSighting(
      app.vehicles,
      PORSCHE_911_AT_142000_KM,
      '2026-10-02T06:10:02.000Z',
      rejected([{ kind: 'mileageAbove', km: 142000, maxKm: 100000 }]),
    );
    const beetle = storeFirstSighting(
      app.vehicles,
      laCentraleDigestListing('69115730001', 'VOLKSWAGEN COCCINELLE', 10500, 92000),
      '2026-10-03T06:41:30.271Z',
      rejected([{ kind: 'disabledBrand', make: 'Volkswagen' }]),
    );
    const meriva = storeFirstSighting(
      app.vehicles,
      laCentraleDigestListing('69115730002', 'OPEL MERIVA II phase 2', 8900, 76000),
      '2026-10-03T06:41:30.459Z',
      rejected([{ kind: 'disabledBrand', make: 'Opel' }, { kind: 'notSpecial' }]),
    );
    const discovery = storeFirstSighting(
      app.vehicles,
      laCentraleDigestListing('69115730003', 'LAND ROVER DISCOVERY SPORT', 14500, 120000),
      '2026-10-03T06:41:30.640Z',
      rejected([
        { kind: 'unfollowedBrand', make: 'Land Rover' },
        { kind: 'mileageAbove', km: 120000, maxKm: 100000 },
      ]),
    );
    const pagoda = storeFirstSighting(
      app.vehicles,
      MERCEDES_280_SL_FROM_A_DEALER,
      '2026-10-03T07:35:41.000Z',
      rejected([{ kind: 'professionalSeller' }]),
    );
    const koleos = storeFirstSighting(
      app.vehicles,
      laCentraleDigestListing('69115730104', 'RENAULT KOLEOS', 14700, 131000),
      '2026-10-05T06:12:00.000Z',
      rejected([{ kind: 'notSpecial' }, { kind: 'mileageAbove', km: 131000, maxKm: 100000 }]),
    );
    const porsche997 = storeFirstSighting(
      app.vehicles,
      PORSCHE_997_PRO,
      '2026-10-09T06:10:00.000Z',
      rejected([{ kind: 'professionalSeller' }, { kind: 'outsideRadius', distanceKm: 107.4, radiusKm: 100 }]),
    );
    const bmw = storeFirstSighting(
      app.vehicles,
      BMW_M3_E46,
      '2026-10-10T07:35:00.000Z',
      rejected([{ kind: 'mileageAbove', km: 128000, maxKm: 100000 }]),
    );
    const audi = storeFirstSighting(app.vehicles, AUDI_A3, '2026-10-11T08:15:00.000Z', rejected([{ kind: 'notSpecial' }]));
    const toyota = storeFirstSighting(
      app.vehicles,
      TOYOTA_GR_YARIS,
      '2026-10-12T06:58:00.000Z',
      rejected([{ kind: 'unfollowedBrand', make: 'Toyota' }]),
    );
    const mazda = storeFirstSighting(
      app.vehicles,
      MAZDA_5,
      '2026-10-13T07:02:00.000Z',
      rejected([{ kind: 'unfollowedBrand', make: 'Mazda' }]),
    );
    const porsche = storeFirstSighting(app.vehicles, PORSCHE_911_4S, '2026-10-13T07:20:00.000Z', KEPT);
    return { porsche142000, beetle, meriva, discovery, pagoda, koleos, porsche997, bmw, audi, toyota, mazda, porsche };
  };

  it('les écartées des 14 derniers jours sont comptées par groupe de raison, et la liste montre d’abord celles des marques suivies', () => {
    // Given
    const app = world();
    const { porsche142000, pagoda, koleos, porsche997, bmw, audi } = rejectedOfTheFortnight(app);

    // When
    const list = listVehicles(app, { status: 'ecartees' });

    // Then
    expect(list.rejectedCounts).toEqual({ tous: 11, suivies: 6, loin: 1, km: 4, special: 3, pro: 2, marque: 5 });
    expect(idsOf(list)).toEqual([audi, bmw, porsche997, koleos, pagoda, porsche142000].map((sighting) => sighting.vehicleId));
  });

  it('le groupe « Trop de km » montre la BMW M3, le Koleos, le Discovery Sport et la 911 à 142 000 km, et les compteurs restent ceux des 14 jours', () => {
    // Given
    const app = world();
    const { porsche142000, discovery, koleos, bmw } = rejectedOfTheFortnight(app);

    // When
    const list = listVehicles(app, { status: 'ecartees', kind: 'km' });

    // Then
    expect(idsOf(list)).toEqual([bmw, koleos, discovery, porsche142000].map((sighting) => sighting.vehicleId));
    expect(list.rejectedCounts).toEqual({ tous: 11, suivies: 6, loin: 1, km: 4, special: 3, pro: 2, marque: 5 });
  });

  it('la 911 (997) d’un professionnel à Angoulême apparaît à la fois chez les vendeurs pro et chez les trop loin', () => {
    // Given
    const app = world();
    const { pagoda, porsche997 } = rejectedOfTheFortnight(app);

    // When
    const professionals = listVehicles(app, { status: 'ecartees', kind: 'pro' });
    const tooFar = listVehicles(app, { status: 'ecartees', kind: 'loin' });

    // Then
    expect(idsOf(professionals)).toEqual([porsche997.vehicleId, pagoda.vehicleId]);
    expect(idsOf(tooFar)).toEqual([porsche997.vehicleId]);
  });

  it('le groupe « Ni supercar ni collection » montre l’Audi A3, le Koleos et la Meriva', () => {
    // Given
    const app = world();
    const { meriva, koleos, audi } = rejectedOfTheFortnight(app);

    // When
    const list = listVehicles(app, { status: 'ecartees', kind: 'special' });

    // Then
    expect(idsOf(list)).toEqual([audi, koleos, meriva].map((sighting) => sighting.vehicleId));
  });

  it('le groupe « Autres marques » range les marques hors des familles suivies avec les marques décochées, et « Toutes » montre les onze écartées de la quinzaine', () => {
    // Given
    const app = world();
    const { porsche142000, beetle, meriva, discovery, pagoda, koleos, porsche997, bmw, audi, toyota, mazda } = rejectedOfTheFortnight(app);

    // When
    const otherBrands = listVehicles(app, { status: 'ecartees', kind: 'marque' });
    const all = listVehicles(app, { status: 'ecartees', kind: 'tous' });

    // Then
    expect(idsOf(otherBrands)).toEqual([mazda, toyota, discovery, meriva, beetle].map((sighting) => sighting.vehicleId));
    expect(idsOf(all)).toEqual(
      [mazda, toyota, audi, bmw, porsche997, koleos, pagoda, discovery, meriva, beetle, porsche142000].map(
        (sighting) => sighting.vehicleId,
      ),
    );
  });

  it('« Garder quand même » sur l’Audi A3 écartée : elle quitte les écartées et rejoint les annonces à traiter', () => {
    // Given
    const app = world();
    const { audi, porsche } = rejectedOfTheFortnight(app);

    // When
    updateVehicle(app, audi.vehicleId, { keep: true, status: 'nouveau' });

    // Then
    const rejectedList = listVehicles(app, { status: 'ecartees' });
    expect(idsOf(rejectedList)).not.toContain(audi.vehicleId);
    expect(rejectedList.rejectedCounts).toEqual({ tous: 10, suivies: 5, loin: 1, km: 4, special: 2, pro: 2, marque: 5 });
    expect(idsOf(listVehicles(app))).toEqual([porsche.vehicleId, audi.vehicleId]);
  });
});
