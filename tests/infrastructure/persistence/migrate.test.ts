import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import Database from 'better-sqlite3';
import { describe, expect, it, vi } from 'vitest';
import type { RejectionReason } from '../../../src/domain/filtering/verdict.js';
import { openDatabase } from '../../../src/infrastructure/persistence/sqlite/connection.js';
import { migrate } from '../../../src/infrastructure/persistence/sqlite/migrate.js';
import { buildLegacyDatabase, LEGACY_SESSION_TOKENS } from '../../fixtures/db/buildLegacyDatabase.js';
import { updateNightClock } from '../../support/updateNight.js';

const LATEST_VERSION = 4;

const FREE_PAGES_LEFT_ON_DISK = 5;

const LEGACY_SCHEMA = readFileSync(new URL('../../fixtures/db/schema-legacy.sql', import.meta.url), 'utf8');

const FIRST_VERSION_SCHEMA = LEGACY_SCHEMA.split('\n')
  .filter((line) => !line.startsWith('ALTER TABLE'))
  .join('\n');

type Row = Readonly<Record<string, unknown>>;

type SchemaObject = { readonly type: string; readonly name: string; readonly tbl_name: string; readonly sql: string | null };

type StoredRejection = { readonly vehicle_id: number; readonly kind: string; readonly payload: string };

type Content = Readonly<Record<string, readonly Row[]>>;

const describeSchema = (db: Database.Database) => ({
  userVersion: db.pragma('user_version', { simple: true }),
  objects: db
    .prepare<[], SchemaObject>('SELECT type, name, tbl_name, sql FROM sqlite_master ORDER BY type, name')
    .all()
    .map((object) => ({
      ...object,
      sql: object.sql === null ? null : object.sql.replace(/\s+/g, ' '),
      columns: object.type === 'table' ? db.pragma(`table_xinfo(${object.name})`) : [],
      foreignKeys: object.type === 'table' ? db.pragma(`foreign_key_list(${object.name})`) : [],
      indexes: object.type === 'table' ? db.pragma(`index_list(${object.name})`) : [],
      indexedColumns: object.type === 'index' ? db.pragma(`index_xinfo(${object.name})`) : [],
    })),
});

const contentOf = (db: Database.Database): Content =>
  Object.fromEntries(
    db
      .prepare<[], { readonly name: string }>("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name")
      .all()
      .map(({ name }) => [name, db.prepare<[], Row>(`SELECT * FROM ${name} ORDER BY rowid`).all()]),
  );

const readFile = <T>(file: string, read: (db: Database.Database) => T): T => {
  const db = new Database(file);
  try {
    return read(db);
  } finally {
    db.close();
  }
};

const migrateFile = (file: string): void => {
  const db = openDatabase(file);
  try {
    migrate(db, updateNightClock());
  } finally {
    db.close();
  }
};

const errorOf = (run: () => void): string => {
  try {
    run();
    return '';
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
};

const rejectionsOf = (db: Database.Database): ReadonlyArray<readonly [number, readonly RejectionReason[]]> => {
  const rows = db
    .prepare<[], StoredRejection>('SELECT vehicle_id, kind, payload FROM vehicle_rejections ORDER BY vehicle_id, position')
    .all();
  const vehicleIds = [...new Set(rows.map((row) => row.vehicle_id))];
  return vehicleIds.map((vehicleId) => [
    vehicleId,
    rows.filter((row) => row.vehicle_id === vehicleId).map((row) => ({ kind: row.kind, ...JSON.parse(row.payload) })),
  ]);
};

const inTemporaryDirectory = (run: (dir: string) => void): void => {
  const dir = mkdtempSync(join(tmpdir(), 'autoveille-migrate-'));
  try {
    run(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
};

const withoutKeys = (rows: readonly Row[], keys: readonly string[]): readonly Row[] =>
  rows.map((row) => Object.fromEntries(Object.entries(row).filter(([key]) => !keys.includes(key))));

const firstVersionDatabase = (): Database.Database => {
  const db = openDatabase(':memory:');
  db.exec(FIRST_VERSION_SCHEMA);
  return db;
};

const insertRejectedVehicle = (
  db: Database.Database,
  vehicle: { readonly distanceKm: number | null; readonly reasons: readonly string[] },
): void => {
  db.prepare(
    `INSERT INTO vehicles (fingerprint, make, model, family, year, km, price, city, postal_code, distance_km, matched, reasons, first_seen_at, last_seen_at)
     VALUES ('4b1c9e07a2d35f68', 'Ford', 'Mustang', 'americaines', 1967, 1200000, 38900, 'Agen', '47000', ?, 0, ?, '2026-10-02T06:10:11.204Z', '2026-10-02T06:10:11.204Z')`,
  ).run(vehicle.distanceKm, JSON.stringify(vehicle.reasons));
};

describe('migrations SQLite numérotées par PRAGMA user_version', () => {
  it('la base de production héritée (version 0, toutes ses tables) est migrée en place sans perdre ni modifier une seule ligne', () =>
    inTemporaryDirectory((dir) => {
      // Given
      const file = join(dir, 'autoveille.sqlite');
      buildLegacyDatabase(file);
      const before = readFile(file, contentOf);

      // When
      migrateFile(file);

      // Then
      const after = readFile(file, contentOf);
      const unchangedTables = Object.keys(before).filter((table) => table !== 'vehicles' && table !== 'sessions');
      expect(Object.fromEntries(unchangedTables.map((table) => [table, after[table]]))).toEqual(
        Object.fromEntries(unchangedTables.map((table) => [table, before[table]])),
      );
      expect(withoutKeys(after.vehicles ?? [], ['sort_at'])).toEqual(withoutKeys(before.vehicles ?? [], ['reasons']));
      expect(withoutKeys(after.sessions ?? [], ['expires_at'])).toEqual(before.sessions);
      expect(Object.fromEntries(Object.entries(after).map(([table, rows]) => [table, rows.length]))).toEqual({
        emails_processed: 17,
        events: 34,
        geo_cache: 14,
        listings: 22,
        mail_state: 1,
        price_history: 24,
        push_subscriptions: 2,
        secrets: 6,
        sessions: 3,
        settings: 1,
        source_runs: 3,
        sqlite_sequence: 4,
        vehicle_rejections: 15,
        vehicles: 20,
      });
      expect(after.sqlite_sequence).toContainEqual({ name: 'vehicles', seq: 21 });
    }));

  it('les raisons d’écart enregistrées en français deviennent des raisons typées, une à une, dans leur ordre et avec leurs valeurs', () =>
    inTemporaryDirectory((dir) => {
      // Given
      const file = join(dir, 'autoveille.sqlite');
      buildLegacyDatabase(file);

      // When
      migrateFile(file);

      // Then
      const expected: ReadonlyArray<readonly [number, readonly RejectionReason[]]> = [
        [4, [{ kind: 'mileageAbove', km: 142000, maxKm: 100000 }]],
        [7, [{ kind: 'notSpecial' }]],
        [9, [{ kind: 'professionalSeller' }]],
        [10, [{ kind: 'professionalSeller' }, { kind: 'outsideRadius', distanceKm: 106.95335795652167, radiusKm: 100 }]],
        [13, [{ kind: 'unfollowedBrand', make: 'Mazda' }]],
        [14, [{ kind: 'unknownBrand' }]],
        [15, [{ kind: 'notSpecial' }, { kind: 'mileageAbove', km: 131000, maxKm: 100000 }]],
        [17, [{ kind: 'outsideRadius', distanceKm: 180.02914454030503, radiusKm: 100 }]],
        [18, [{ kind: 'disabledBrand', make: 'Volkswagen' }]],
        [19, [{ kind: 'disabledBrand', make: 'Opel' }, { kind: 'notSpecial' }]],
        [
          20,
          [
            { kind: 'unfollowedBrand', make: 'Land Rover' },
            { kind: 'mileageAbove', km: 120000, maxKm: 100000 },
          ],
        ],
      ];
      expect(readFile(file, rejectionsOf)).toEqual(expected);
      expect(
        readFile(file, (db) => db.prepare("SELECT COUNT(*) AS columns FROM pragma_table_info('vehicles') WHERE name = 'reasons'").get()),
      ).toEqual({
        columns: 0,
      });
    }));

  it('chaque voiture se trie par sa date de mise en ligne, et la BMW M3 lue sur Leparking, qui n’en a pas, par sa date d’arrivée', () =>
    inTemporaryDirectory((dir) => {
      // Given
      const file = join(dir, 'autoveille.sqlite');
      buildLegacyDatabase(file);

      // When
      migrateFile(file);

      // Then
      const vehicles = readFile(file, (db) =>
        db
          .prepare<
            [],
            { readonly id: number; readonly sort_at: string; readonly published_at: string | null; readonly first_seen_at: string }
          >('SELECT id, sort_at, published_at, first_seen_at FROM vehicles ORDER BY id')
          .all(),
      );
      expect(vehicles.every((vehicle) => vehicle.sort_at === (vehicle.published_at ?? vehicle.first_seen_at))).toBe(true);
      expect(vehicles.find((vehicle) => vehicle.id === 21)).toEqual({
        id: 21,
        sort_at: '2026-10-08T09:00:02.611Z',
        published_at: null,
        first_seen_at: '2026-10-08T09:00:02.611Z',
      });
    }));

  it('une date de mise en ligne apprise après la migration déplace la voiture dans le tri sans que personne n’écrive sa date de tri', () =>
    inTemporaryDirectory((dir) => {
      // Given
      const file = join(dir, 'autoveille.sqlite');
      buildLegacyDatabase(file);
      migrateFile(file);

      // When
      readFile(file, (db) => db.prepare("UPDATE vehicles SET published_at = '2026-10-07T18:30:00.000Z' WHERE id = 21").run());

      // Then
      expect(
        readFile(file, (db) => db.prepare<[], { readonly sort_at: string }>('SELECT sort_at FROM vehicles WHERE id = 21').get()),
      ).toEqual({
        sort_at: '2026-10-07T18:30:00.000Z',
      });
    }));

  it('les trois appareils connectés avant la mise à jour restent connectés 180 jours à partir de la migration, même la session ouverte le 14/09', () =>
    inTemporaryDirectory((dir) => {
      // Given
      const file = join(dir, 'autoveille.sqlite');
      buildLegacyDatabase(file);

      // When
      migrateFile(file);

      // Then
      const sessions = readFile(file, (db) =>
        db
          .prepare<[], { readonly token: string; readonly created_at: string; readonly expires_at: string }>(
            'SELECT token, created_at, expires_at FROM sessions ORDER BY created_at',
          )
          .all(),
      );
      expect(sessions.map((session) => [session.token, session.created_at, session.expires_at])).toEqual([
        [LEGACY_SESSION_TOKENS[0], '2026-09-14T16:04:12.331Z', '2027-04-14T03:00:00.000Z'],
        [LEGACY_SESSION_TOKENS[1], '2026-09-14T16:40:55.908Z', '2027-04-14T03:00:00.000Z'],
        [LEGACY_SESSION_TOKENS[2], '2026-10-06T07:15:02.117Z', '2027-04-14T03:00:00.000Z'],
      ]);
    }));

  it('relancer l’application sur une base déjà migrée ne change rien : même version, même schéma, mêmes lignes', () =>
    inTemporaryDirectory((dir) => {
      // Given
      const file = join(dir, 'autoveille.sqlite');
      buildLegacyDatabase(file);
      migrateFile(file);
      const migrated = readFile(file, (db) => ({ schema: describeSchema(db), content: contentOf(db) }));

      // When
      migrateFile(file);

      // Then
      expect(readFile(file, (db) => ({ schema: describeSchema(db), content: contentOf(db) }))).toEqual(migrated);
      expect(migrated.schema.userVersion).toBe(LATEST_VERSION);
    }));

  it('revenu à cette version après une mise à jour qui a migré la base une version plus loin, le serveur refuse de démarrer sans toucher à la base, et le journal dit quoi faire', () =>
    inTemporaryDirectory((dir) => {
      // Given
      const file = join(dir, 'autoveille.sqlite');
      buildLegacyDatabase(file);
      migrateFile(file);
      readFile(file, (db) => db.pragma(`user_version = ${LATEST_VERSION + 1}`));
      const before = readFile(file, (db) => ({ schema: describeSchema(db), content: contentOf(db) }));

      // When
      const failure = errorOf(() => migrateFile(file));

      // Then
      expect(failure).toBe(
        `Base de données en version ${LATEST_VERSION + 1}, plus récente que cette version de l’application (version ${LATEST_VERSION} au plus) : une version plus récente l’a déjà migrée. ` +
          'Démarrage refusé pour ne pas l’abîmer : réinstallez la version plus récente, ou restaurez la sauvegarde prise avant sa mise à jour (README.md, section « Exploitation »).',
      );
      expect(readFile(file, (db) => ({ schema: describeSchema(db), content: contentOf(db) }))).toEqual(before);
    }));

  it('une base neuve reçoit le schéma hérité puis les mêmes ajouts : elle a exactement le schéma d’une base de production migrée', () =>
    inTemporaryDirectory((dir) => {
      // Given
      const production = join(dir, 'production.sqlite');
      const fresh = join(dir, 'neuve.sqlite');
      buildLegacyDatabase(production);

      // When
      migrateFile(production);
      migrateFile(fresh);

      // Then
      expect(readFile(fresh, describeSchema)).toEqual(readFile(production, describeSchema));
      expect(readFile(fresh, describeSchema).userVersion).toBe(LATEST_VERSION);
    }));

  it('une base créée par la première version (14/10/2026, sans description, note ni date de mise en ligne) reçoit ces colonnes et migre jusqu’au bout', () =>
    inTemporaryDirectory((dir) => {
      // Given
      const file = join(dir, 'autoveille.sqlite');
      const old = openDatabase(file);
      old.exec(FIRST_VERSION_SCHEMA);
      old
        .prepare(
          `INSERT INTO vehicles (fingerprint, make, model, family, year, km, price, city, postal_code, lat, lon, distance_km, matched, reasons, first_seen_at, last_seen_at)
           VALUES ('9d0a5c2e7f1b3486', 'Mazda', 'MX-5', 'autres', 1990, 168000, 9900, 'Agen', '47000', 44.2033, 0.6163, 117.3418, 0,
                   '["marque Mazda hors des familles suivies","168 000 km, au-dessus de 100 000 km","à 117 km, hors du rayon de 100 km"]',
                   '2026-10-14T13:02:44.180Z', '2026-10-14T13:02:44.180Z')`,
        )
        .run();
      old
        .prepare(
          `INSERT INTO listings (vehicle_id, site, site_label, external_id, url, title, price, km, year, city, postal_code, seller_type, first_seen_at, last_seen_at)
           VALUES (1, 'leboncoin', 'Leboncoin', '2830554417', 'https://www.leboncoin.fr/ad/voitures/2830554417', 'Mazda MX-5 1.6 115ch 1990', 9900, 168000, 1990,
                   'Agen', '47000', 'particulier', '2026-10-14T13:02:44.180Z', '2026-10-14T13:02:44.180Z')`,
        )
        .run();
      old.close();

      // When
      migrateFile(file);

      // Then
      const fresh = join(dir, 'neuve.sqlite');
      migrateFile(fresh);
      expect(readFile(file, describeSchema)).toEqual(readFile(fresh, describeSchema));
      expect(readFile(file, (db) => db.prepare('SELECT note, published_at, sort_at FROM vehicles').all())).toEqual([
        { note: null, published_at: null, sort_at: '2026-10-14T13:02:44.180Z' },
      ]);
      expect(readFile(file, (db) => db.prepare('SELECT title, description FROM listings').all())).toEqual([
        { title: 'Mazda MX-5 1.6 115ch 1990', description: null },
      ]);
      expect(readFile(file, rejectionsOf)).toEqual([
        [
          1,
          [
            { kind: 'unfollowedBrand', make: 'Mazda' },
            { kind: 'mileageAbove', km: 168000, maxKm: 100000 },
            { kind: 'outsideRadius', distanceKm: 117.3418, radiusKm: 100 },
          ],
        ],
      ]);
    }));

  it('une Mustang annoncée à « 1 200 000 km » (compteur saisi de travers) garde ses deux séparateurs de milliers hors du nombre', () => {
    // Given
    const db = firstVersionDatabase();
    insertRejectedVehicle(db, {
      distanceKm: 107.66,
      reasons: ['1 200 000 km, au-dessus de 100 000 km', 'à 108 km, hors du rayon de 100 km'],
    });

    // When
    migrate(db, updateNightClock());

    // Then
    expect(rejectionsOf(db)).toEqual([
      [
        1,
        [
          { kind: 'mileageAbove', km: 1200000, maxKm: 100000 },
          { kind: 'outsideRadius', distanceKm: 107.66, radiusKm: 100 },
        ],
      ],
    ]);
    db.close();
  });

  it('une phrase d’écart qu’aucune version de l’application n’a écrite (base retouchée à la main) est gardée telle quelle, à sa place', () => {
    // Given
    const db = firstVersionDatabase();
    insertRejectedVehicle(db, { distanceKm: 107.66, reasons: ['vendeur professionnel', 'trop de kilomètres pour un client'] });

    // When
    migrate(db, updateNightClock());

    // Then
    expect(db.prepare('SELECT position, kind, payload FROM vehicle_rejections ORDER BY position').all()).toEqual([
      { position: 0, kind: 'professionalSeller', payload: '{}' },
      { position: 1, kind: 'unrecognizedPhrase', payload: '{"phrase":"trop de kilomètres pour un client"}' },
    ]);
    db.close();
  });

  it('le disque du serveur se remplit pendant la création des index de tri : la base reste en version 2, raisons d’écart converties mais sans date de tri, et le redémarrage suivant, une fois de la place libérée, termine la migration', () =>
    inTemporaryDirectory((dir) => {
      // Given
      const file = join(dir, 'autoveille.sqlite');
      buildLegacyDatabase(file);
      const legacy = readFile(file, contentOf);
      const server = openDatabase(file);
      server.pragma(`max_page_count = ${Number(server.pragma('page_count', { simple: true })) + FREE_PAGES_LEFT_ON_DISK}`);

      // When
      const failure = errorOf(() => migrate(server, updateNightClock()));
      server.close();
      const afterFailure = readFile(file, (db) => ({
        userVersion: db.pragma('user_version', { simple: true }),
        vehicleColumns: db.prepare<[], { readonly name: string }>("SELECT name FROM pragma_table_xinfo('vehicles')").all(),
        indexes: db
          .prepare<[], { readonly name: string }>("SELECT name FROM sqlite_master WHERE type = 'index' AND name LIKE 'idx_%' ORDER BY name")
          .all(),
        content: contentOf(db),
      }));
      migrateFile(file);

      // Then
      expect(failure).toBe('database or disk is full');
      expect(afterFailure.userVersion).toBe(2);
      expect(afterFailure.vehicleColumns.map((column) => column.name)).not.toContain('sort_at');
      expect(afterFailure.vehicleColumns.map((column) => column.name)).not.toContain('reasons');
      expect(afterFailure.indexes.map((index) => index.name)).toEqual(['idx_events_vehicle', 'idx_listings_vehicle', 'idx_vehicles_fp']);
      expect(afterFailure.content.vehicle_rejections).toHaveLength(15);
      expect(afterFailure.content.vehicles).toEqual(withoutKeys(legacy.vehicles ?? [], ['reasons']));
      expect(readFile(file, describeSchema).userVersion).toBe(LATEST_VERSION);
    }));

  it('la commande npm run demo lancée pendant que le serveur tout juste mis à jour migre la même base : elle la trouve déjà migrée et s’ouvre sans erreur', () =>
    inTemporaryDirectory((dir) => {
      // Given
      const file = join(dir, 'autoveille.sqlite');
      buildLegacyDatabase(file);
      const server = openDatabase(file);
      const demo = openDatabase(file);
      const demoTransaction = demo.transaction.bind(demo);
      vi.spyOn(demo, 'transaction').mockImplementationOnce((work) => {
        migrate(server, updateNightClock());
        return demoTransaction(work);
      });

      // When
      const failure = errorOf(() => migrate(demo, updateNightClock()));

      // Then
      expect(failure).toBe('');
      expect(demo.pragma('user_version', { simple: true })).toBe(LATEST_VERSION);
      expect(rejectionsOf(demo).flatMap(([, reasons]) => reasons)).toHaveLength(15);
      server.close();
      demo.close();
    }));

  it('supprimer une voiture mal lue efface aussi ses raisons d’écart', () =>
    inTemporaryDirectory((dir) => {
      // Given
      const file = join(dir, 'autoveille.sqlite');
      buildLegacyDatabase(file);
      migrateFile(file);
      const db = openDatabase(file);

      // When
      db.prepare('DELETE FROM vehicles WHERE id = 20').run();

      // Then
      expect(db.prepare('SELECT COUNT(*) AS remaining FROM vehicle_rejections WHERE vehicle_id = 20').get()).toEqual({ remaining: 0 });
      expect(db.prepare('SELECT COUNT(*) AS remaining FROM vehicle_rejections').get()).toEqual({ remaining: 13 });
      db.close();
    }));
});
