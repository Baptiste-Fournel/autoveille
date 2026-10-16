import type Database from 'better-sqlite3';
import { describe, expect, it, vi } from 'vitest';
import type { VehicleCursor, VehicleRepository, VehicleSelection } from '../../../src/application/ports/vehicleRepository.js';
import { newListing } from '../../../src/domain/vehicle/changes.js';
import { sqliteTransaction } from '../../../src/infrastructure/persistence/sqlite/sqliteTransaction.js';
import { SqliteVehicleRepository } from '../../../src/infrastructure/persistence/sqlite/sqliteVehicleRepository.js';
import {
  ALPINE_A110,
  BMW_M3_E46,
  CORVETTE_C7,
  FERRARI_360,
  FORD_MUSTANG_MERGED,
  FORD_RANGER_RAPTOR,
  firstSighting,
  MERCEDES_C63,
  PORSCHE_911_4S,
  PORSCHE_997_PRO,
  storeFirstSighting,
} from '../../contracts/vehicleSamples.js';
import { migratedLegacyDatabase } from '../../support/migratedLegacyDatabase.js';
import { migratedSqliteDatabase } from '../../support/migratedSqliteDatabase.js';

const FOUR_WEEKS_AGO = '2026-09-14T00:00:00.000Z';
const WEEK_START = '2026-10-08T08:30:00.000Z';
const NOUVEAU: VehicleSelection = { kind: 'kept', status: 'nouveau' };

type Row = Readonly<Record<string, unknown>>;

const pagesOf = (
  repository: VehicleRepository,
  selection: VehicleSelection,
  limit: number,
  after?: VehicleCursor,
): ReadonlyArray<readonly number[]> => {
  const page = repository.page({ selection, after, limit });
  const ids = page.vehicles.map((vehicle) => vehicle.id);
  return page.nextCursor === undefined ? [ids] : [ids, ...pagesOf(repository, selection, limit, page.nextCursor)];
};

const rowsOf = (database: Database.Database, sql: string, ...parameters: readonly unknown[]): readonly Row[] =>
  database.prepare<unknown[], Row>(sql).all(...parameters);

const queryPlanOf = (database: Database.Database, sql: string, parameters: readonly unknown[]): readonly string[] =>
  database
    .prepare<unknown[], { readonly detail: string }>(`EXPLAIN QUERY PLAN ${sql}`)
    .all(...parameters)
    .map(({ detail }) => detail);

const bmwWithHandEditedRejection = () => {
  const database = migratedSqliteDatabase();
  const repository = new SqliteVehicleRepository(database);
  const { vehicleId } = storeFirstSighting(repository, BMW_M3_E46, '2026-10-12T07:35:00.000Z', { matched: false, rejections: [] });
  database
    .prepare("INSERT INTO vehicle_rejections (vehicle_id, position, kind, payload) VALUES (?, 0, 'unrecognizedPhrase', ?)")
    .run(vehicleId, JSON.stringify({ phrase: 'doublon de l’annonce La Centrale' }));
  return { database, repository, vehicleId };
};

describe('VehicleRepository sur SQLite : ce que la base ajoute au contrat', () => {
  it('la base de production de quatre semaines, migrée, range ses onze écartées dans les mêmes groupes qu’avant la mise à jour, marques désactivées et marque non reconnue comprises', () => {
    // Given
    const repository = new SqliteVehicleRepository(migratedLegacyDatabase());
    const rejected = (selection: VehicleSelection) =>
      repository
        .page({ selection, firstSeenSince: FOUR_WEEKS_AGO, limit: 50 })
        .vehicles.map((vehicle) => [vehicle.id, vehicle.rejections] as const);

    // When
    const counts = repository.rejectedCounts(FOUR_WEEKS_AGO);
    const brands = rejected({ kind: 'rejected', withGroup: 'marque' });
    const tooFar = rejected({ kind: 'rejected', withGroup: 'loin' });

    // Then
    expect(counts).toEqual({ all: 11, byGroup: { marque: 5, special: 3, pro: 2, km: 3, loin: 2 } });
    expect(brands).toEqual([
      [18, [{ kind: 'disabledBrand', make: 'Volkswagen' }]],
      [19, [{ kind: 'disabledBrand', make: 'Opel' }, { kind: 'notSpecial' }]],
      [
        20,
        [
          { kind: 'unfollowedBrand', make: 'Land Rover' },
          { kind: 'mileageAbove', km: 120000, maxKm: 100000 },
        ],
      ],
      [13, [{ kind: 'unfollowedBrand', make: 'Mazda' }]],
      [14, [{ kind: 'unknownBrand' }]],
    ]);
    expect(tooFar).toEqual([
      [17, [{ kind: 'outsideRadius', distanceKm: 180.02914454030503, radiusKm: 100 }]],
      [10, [{ kind: 'professionalSeller' }, { kind: 'outsideRadius', distanceKm: 106.95335795652167, radiusKm: 100 }]],
    ]);
  });

  it('l’onglet « Tous » de la base de production migrée se parcourt deux annonces à la fois : la BMW M3 Compétition, sans date de mise en ligne, par son arrivée, et les annonces d’un même email dans l’ordre de l’email, comme avant la mise à jour, sans doublon ni oubli', () => {
    // Given
    const repository = new SqliteVehicleRepository(migratedLegacyDatabase());

    // When
    const pages = pagesOf(repository, { kind: 'kept' }, 2);

    // Then
    expect(pages).toEqual([[21, 11], [12, 8], [5, 6], [3, 2], [1]]);
  });

  it('les onglets de la base de production migrée comptent ses neuf annonces retenues par statut, les onze écartées ne comptant nulle part', () => {
    // Given
    const repository = new SqliteVehicleRepository(migratedLegacyDatabase());

    // When
    const counts = repository.countsByStatus();

    // Then
    expect(counts).toEqual({ nouveau: 4, contacte: 2, repondu: 1, ignore: 2 });
  });

  it('l’onglet « À traiter » se lit page après page dans l’index des annonces retenues par statut et date de tri, sans trier toute la table', () => {
    // Given
    const database = migratedSqliteDatabase();
    const prepare = vi.spyOn(database, 'prepare');
    const repository = new SqliteVehicleRepository(database);
    const statements = prepare.mock.results.flatMap((result) => (result.type === 'return' ? [result.value] : []));
    prepare.mockRestore();
    storeFirstSighting(repository, PORSCHE_911_4S, '2026-10-13T07:00:00.000Z');
    storeFirstSighting(repository, FERRARI_360, '2026-10-13T07:05:00.000Z');
    storeFirstSighting(repository, CORVETTE_C7, '2026-10-13T07:10:00.000Z');
    const reads = statements.map((statement) => vi.spyOn(statement, 'all'));

    // When
    const first = repository.page({ selection: NOUVEAU, limit: 2 });
    repository.page({ selection: NOUVEAU, after: first.nextCursor, limit: 2 });

    // Then
    const plans = statements.flatMap((statement, index) =>
      (reads[index]?.mock.calls ?? []).map((parameters) => queryPlanOf(database, statement.source, parameters)),
    );
    expect(
      plans.map((plan) =>
        plan.filter((detail) => detail.includes(' vehicles ') || (detail.startsWith('USE TEMP B-TREE') && detail.endsWith('ORDER BY'))),
      ),
    ).toEqual([
      ['SEARCH vehicles USING INDEX idx_vehicles_matched_status_sort (matched=? AND status=?)'],
      ['SEARCH vehicles USING INDEX idx_vehicles_matched_status_sort (matched=? AND status=? AND sort_at<?)'],
    ]);
  });

  it('la date de mise en ligne relevée sur la page La Centrale fait passer la Mercedes-AMG C63, arrivée la dernière, derrière la 911 mise en ligne après elle', () => {
    // Given
    const repository = new SqliteVehicleRepository(migratedSqliteDatabase());
    const porsche = storeFirstSighting(
      repository,
      { ...PORSCHE_911_4S, publishedAt: '2026-10-12T10:00:00.000Z' },
      '2026-10-13T06:00:00.000Z',
    );
    const mercedes = storeFirstSighting(repository, MERCEDES_C63, '2026-10-13T07:00:00.000Z', { matched: true, rejections: [] });
    const before = repository.page({ selection: NOUVEAU, limit: 50 }).vehicles.map((vehicle) => vehicle.id);

    // When
    repository.recordVehicleSighting(mercedes.vehicleId, { publishedAt: '2026-10-11T19:20:00.000Z' });

    // Then
    expect(before).toEqual([mercedes.vehicleId, porsche.vehicleId]);
    expect(repository.page({ selection: NOUVEAU, limit: 50 }).vehicles.map((vehicle) => vehicle.id)).toEqual([
      porsche.vehicleId,
      mercedes.vehicleId,
    ]);
  });

  it('une BMW M3 E46 dont la raison d’écart, retouchée à la main dans l’ancienne base, n’a été écrite par aucune version reste parmi les écartées « suivies », sans groupe ni raison affichée', () => {
    // Given
    const { repository, vehicleId } = bmwWithHandEditedRejection();

    // When
    const followed = repository.page({ selection: { kind: 'rejected', withoutGroup: 'marque' }, limit: 50 });
    const tooManyKm = repository.page({ selection: { kind: 'rejected', withGroup: 'km' }, limit: 50 });
    const counts = repository.rejectedCounts(WEEK_START);

    // Then
    expect(repository.vehicle(vehicleId)?.rejections).toEqual([]);
    expect(followed.vehicles.map((vehicle) => vehicle.id)).toEqual([vehicleId]);
    expect(tooManyKm.vehicles).toEqual([]);
    expect(counts).toEqual({ all: 1, byGroup: { marque: 0, special: 0, pro: 0, km: 0, loin: 0 } });
  });

  it('la réévaluation qui écarte la BMW M3 E46 pour ses 128 000 km remplace la raison retouchée à la main par la sienne', () => {
    // Given
    const { database, repository, vehicleId } = bmwWithHandEditedRejection();
    const before = repository.vehicle(vehicleId);

    // When
    repository.applyReevaluation(vehicleId, {
      matched: false,
      rejections: [{ kind: 'mileageAbove', km: 128000, maxKm: 100000 }],
      distanceKm: before?.distanceKm ?? null,
      make: 'BMW',
      model: 'M3 E46',
      family: 'allemandes',
    });

    // Then
    expect(rowsOf(database, 'SELECT position, kind, payload FROM vehicle_rejections WHERE vehicle_id = ?', vehicleId)).toEqual([
      { position: 0, kind: 'mileageAbove', payload: '{"km":128000,"maxKm":100000}' },
    ]);
  });

  it('supprimer la 911 (997) lue de travers ne laisse aucune ligne derrière elle : ni annonce, ni prix, ni événement, ni raison d’écart', () => {
    // Given
    const database = migratedSqliteDatabase();
    const repository = new SqliteVehicleRepository(database);
    const wrong = storeFirstSighting(repository, PORSCHE_997_PRO, '2026-10-12T07:00:00.000Z', {
      matched: false,
      rejections: [{ kind: 'professionalSeller' }, { kind: 'outsideRadius', distanceKm: 107.4, radiusKm: 100 }],
    });
    repository.addPricePoint(wrong.listingId, { price: 54900, seenAt: '2026-10-12T07:00:00.000Z' });
    repository.addEvent(wrong.vehicleId, { type: 'nouveau', detail: 'La Centrale', at: '2026-10-12T07:00:00.000Z' });
    const kept = storeFirstSighting(repository, ALPINE_A110, '2026-10-12T07:05:00.000Z', {
      matched: false,
      rejections: [{ kind: 'notSpecial' }],
    });
    repository.addPricePoint(kept.listingId, { price: 58900, seenAt: '2026-10-12T07:05:00.000Z' });
    repository.addEvent(kept.vehicleId, { type: 'nouveau', detail: 'AutoScout24', at: '2026-10-12T07:05:00.000Z' });

    // When
    repository.deleteVehicle(wrong.vehicleId);

    // Then
    const owners = {
      listings: rowsOf(database, 'SELECT vehicle_id FROM listings'),
      prices: rowsOf(database, 'SELECT listing_id FROM price_history'),
      events: rowsOf(database, 'SELECT vehicle_id FROM events'),
      rejections: rowsOf(database, 'SELECT vehicle_id FROM vehicle_rejections'),
    };
    expect(owners).toEqual({
      listings: [{ vehicle_id: kept.vehicleId }],
      prices: [{ listing_id: kept.listingId }],
      events: [{ vehicle_id: kept.vehicleId }],
      rejections: [{ vehicle_id: kept.vehicleId }],
    });
  });

  it('« Réparer » sépare la Mustang du ranger raptor, mais le ranger raptor est supprimé depuis le téléphone pendant que la ville de la Mustang est cherchée : son nouveau verdict n’est écrit nulle part et la réparation continue', () => {
    // Given
    const database = migratedSqliteDatabase();
    const repository = new SqliteVehicleRepository(database);
    const transaction = sqliteTransaction(database);
    const ford = storeFirstSighting(repository, FORD_RANGER_RAPTOR, '2026-10-05T07:00:00.000Z');
    const mergedId = repository.addListing(ford.vehicleId, newListing(FORD_MUSTANG_MERGED, '2026-10-06T07:00:00.000Z'));
    const mustang = firstSighting(FORD_MUSTANG_MERGED, '2026-10-06T07:00:00.000Z').vehicle;
    repository.deleteVehicle(ford.vehicleId);

    // When
    const mustangId = transaction.run(() => {
      repository.applyRegrouping(ford.vehicleId, { model: 'Ranger', matched: false, rejections: [{ kind: 'notSpecial' }] });
      const id = repository.addVehicle(mustang);
      repository.moveListings([mergedId], id);
      repository.addEvent(id, { type: 'nouveau', detail: 'Leboncoin', at: '2026-10-16T09:00:00.000Z' });
      return id;
    });

    // Then
    expect(repository.vehicle(ford.vehicleId)).toBeUndefined();
    expect(rowsOf(database, 'SELECT vehicle_id, kind FROM vehicle_rejections ORDER BY vehicle_id, position')).toEqual(
      mustang.rejections.map((reason) => ({ vehicle_id: mustangId, kind: reason.kind })),
    );
    expect(repository.events(mustangId).map((event) => event.type)).toEqual(['nouveau']);
  });
});
