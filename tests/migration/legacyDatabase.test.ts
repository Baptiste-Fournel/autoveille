import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import Database from 'better-sqlite3';
import { describe, expect, it } from 'vitest';
import { repairVehicles } from '../../src/application/ingest/repairVehicles.js';
import { listVehicles } from '../../src/application/vehicles/listVehicles.js';
import { describeRejection } from '../../src/domain/presentation/reasons.js';
import { addMissingLegacyColumns } from '../../src/infrastructure/persistence/sqlite/legacyColumns.js';
import { buildLegacyDatabase, LEGACY_PASSWORD, LEGACY_SESSION_TOKENS } from '../fixtures/db/buildLegacyDatabase.js';
import { SESSION_COOKIE } from '../support/authentication.js';
import { type ComposedApplication, composedApplication } from '../support/composedApplication.js';

const LEGACY_SCHEMA = readFileSync(new URL('../fixtures/db/schema-legacy.sql', import.meta.url), 'utf8');

const INITIAL_MIGRATION = readFileSync(
  new URL('../../src/infrastructure/persistence/sqlite/migrations/001_initial.sql', import.meta.url),
  'utf8',
);

const LATEST_VERSION = 4;

type SchemaObject = { readonly type: string; readonly name: string; readonly tbl_name: string; readonly sql: string | null };

const describeSchema = (db: Database.Database) => ({
  userVersion: db.pragma('user_version', { simple: true }),
  objects: db
    .prepare<[], SchemaObject>('SELECT type, name, tbl_name, sql FROM sqlite_master ORDER BY type, name')
    .all()
    .map((object) => ({
      ...object,
      sql: object.sql === null ? null : object.sql.replace(/\s+/g, ' '),
      columns: object.type === 'table' ? db.pragma(`table_info(${object.name})`) : [],
      foreignKeys: object.type === 'table' ? db.pragma(`foreign_key_list(${object.name})`) : [],
      indexes: object.type === 'table' ? db.pragma(`index_list(${object.name})`) : [],
      indexedColumns: object.type === 'index' ? db.pragma(`index_xinfo(${object.name})`) : [],
    })),
});

const snapshotOf = (file: string) => {
  const db = new Database(file);
  try {
    const tables = db.prepare<[], { readonly name: string }>("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name").all();
    return {
      schema: describeSchema(db),
      rows: tables.map(({ name }) => ({ table: name, rows: db.prepare(`SELECT * FROM ${name} ORDER BY rowid`).all() })),
    };
  } finally {
    db.close();
  }
};

const countOf = (values: readonly string[]): Readonly<Record<string, number>> =>
  Object.fromEntries([...new Set(values)].map((value) => [value, values.filter((other) => other === value).length]));

const inTemporaryDirectory = async (run: (dir: string) => Promise<void> | void): Promise<void> => {
  const dir = mkdtempSync(join(tmpdir(), 'autoveille-legacy-'));
  try {
    await run(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
};

const MAILBOX_READ_ONLY_ON_SCHEDULE = { IMAP_IDLE: '0' };

const startedOn = async <Result>(file: string, run: (application: ComposedApplication) => Promise<Result> | Result): Promise<Result> => {
  const application = await composedApplication({ databaseFile: file, environment: MAILBOX_READ_ONLY_ON_SCHEDULE });
  try {
    await application.start();
    return await run(application);
  } finally {
    await application.stop();
  }
};

const restarted = (file: string): Promise<void> => startedOn(file, () => undefined);

const onUpdatedLegacyDatabase = (run: (application: ComposedApplication) => Promise<void> | void): Promise<void> =>
  inTemporaryDirectory(async (dir) => {
    const file = join(dir, 'autoveille.sqlite');
    buildLegacyDatabase(file);
    await startedOn(file, run);
  });

describe('base de production héritée (schéma de Store.migrate avant la refonte)', () => {
  it('le schéma de la base de production héritée est celui qu’écrit la première migration, avec les trois colonnes ajoutées après la première version', () => {
    // Arrange
    const firstMigration = new Database(':memory:');
    const legacy = new Database(':memory:');

    // Act
    firstMigration.exec(INITIAL_MIGRATION);
    addMissingLegacyColumns(firstMigration);
    legacy.exec(LEGACY_SCHEMA);

    // Assert
    expect(describeSchema(legacy)).toEqual(describeSchema(firstMigration));
    legacy.close();
    firstMigration.close();
  });

  it('le premier démarrage de la nouvelle version migre la base héritée en place, et un second démarrage n’y change plus rien', () =>
    inTemporaryDirectory(async (dir) => {
      // Arrange
      const file = join(dir, 'autoveille.sqlite');
      buildLegacyDatabase(file);
      await restarted(file);
      const migrated = snapshotOf(file);

      // Act
      await restarted(file);

      // Assert
      expect(migrated.schema.userVersion).toBe(LATEST_VERSION);
      expect(snapshotOf(file)).toEqual(migrated);
    }));

  it('après la mise à jour, l’application relit sur la base héritée les véhicules, leurs raisons d’écart, les réglages et les appareils connectés', () =>
    onUpdatedLegacyDatabase(async (application) => {
      // Arrange
      const { ports, server } = application;

      // Act
      const vehicles = ports.vehicles.allVehicles();
      const kept = listVehicles(ports, { status: 'tous', limit: 1000 }).vehicles;
      const devices = await Promise.all(
        LEGACY_SESSION_TOKENS.map((token) =>
          server.inject({ method: 'GET', url: '/api/me', headers: { cookie: `${SESSION_COOKIE}=${server.signCookie(token)}` } }),
        ),
      );

      // Assert
      expect(vehicles.map((v) => v.id)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 17, 18, 19, 20, 21]);
      expect(countOf(vehicles.map((v) => v.status))).toEqual({ nouveau: 15, contacte: 2, repondu: 1, ignore: 2 });
      expect(kept.map((card) => card.vehicle.id).sort((a, b) => a - b)).toEqual([1, 2, 3, 5, 6, 8, 11, 12, 21]);
      expect(vehicles.filter((v) => !v.matched).map((v) => [v.id, v.rejections.map(describeRejection)])).toEqual([
        [4, ['142 000 km, au-dessus de 100 000 km']],
        [7, ['ni supercar ni collection selon les réglages']],
        [9, ['vendeur professionnel']],
        [10, ['vendeur professionnel', 'à 107 km, hors du rayon de 100 km']],
        [13, ['marque Mazda hors des familles suivies']],
        [14, ['marque non reconnue']],
        [15, ['ni supercar ni collection selon les réglages', '131 000 km, au-dessus de 100 000 km']],
        [17, ['à 180 km, hors du rayon de 100 km']],
        [18, ['marque Volkswagen désactivée']],
        [19, ['marque Opel désactivée', 'ni supercar ni collection selon les réglages']],
        [20, ['marque Land Rover hors des familles suivies', '120 000 km, au-dessus de 100 000 km']],
      ]);
      expect(ports.vehicles.vehicle(2)).toMatchObject({
        status: 'repondu',
        reposted: true,
        note: 'A répondu le 17/09 : visite prévue mardi à 14 h, carnet d’entretien complet.',
        messageOverride: expect.stringContaining('Je suis Camille, de Démo Automobiles à Bordeaux.'),
      });
      expect(ports.vehicles.vehicle(8)).toMatchObject({ status: 'ignore', doNotContact: true });
      expect(ports.vehicles.vehicle(12)).toMatchObject({ status: 'contacte', matched: true, rejections: [] });
      expect(ports.vehicles.listingsOf(2).map((l) => l.externalId)).toEqual(['69112345678', '69112345999']);
      expect(ports.vehicles.listingsOf(3).map((l) => l.site)).toEqual(['paruvendu', 'leboncoin']);
      expect(ports.vehicles.priceHistory(1)).toEqual([
        { price: 112900, seenAt: '2026-09-15T07:12:04.512Z' },
        { price: 109900, seenAt: '2026-09-22T07:52:40.087Z' },
      ]);
      expect(ports.vehicles.priceHistory(11).map((p) => p.price)).toEqual([24900, 25900]);
      expect(ports.vehicles.events(6).map((e) => e.type)).toEqual(['statut_nouveau', 'notification_echec', 'nouveau']);
      expect(ports.vehicles.enteredStatusAt(2, 'statut_repondu')).toBe('2026-09-17T14:22:03.660Z');
      expect(new Set(vehicles.flatMap((v) => ports.vehicles.events(v.id).map((e) => e.type)))).toEqual(
        new Set([
          'nouveau',
          'prix_baisse',
          'prix_hausse',
          'republiee',
          'autre_site',
          'notification_echec',
          'statut_nouveau',
          'statut_contacte',
          'statut_repondu',
          'statut_ignore',
          'ne_plus_contacter',
          'garde_manuellement',
        ]),
      );
      expect(vehicles.filter((v) => v.publishedAt === null).map((v) => v.id)).toEqual([15, 21]);
      expect(ports.settings.load()).toMatchObject({
        dealer: { firstName: 'Camille', lastName: 'Durand', company: 'Démo Automobiles', city: 'Bordeaux', phone: '06 39 98 12 34' },
        zone: { postalCode: '33000', radiusKm: 100 },
        maxKm: 100000,
        alertsDone: { paruvendu: true, lacentrale: true, autoscout24: true, leboncoin: true },
        alerts: {
          paruvendu: {
            criteria: "Voiture d'occasion, Bordeaux (33000), Rayon de 100 km, Jusqu'à 100 000 km",
            radiusKm: 100,
            maxKm: 100000,
          },
          lacentrale: { maxKm: 100000, postalCode: '33000', sellerType: 'particulier' },
          autoscout24: { manageUrl: 'https://www.autoscout24.fr/account/searches' },
        },
        httpSites: [
          { id: 'k3v9x2ab', name: 'Leparking', enabled: true },
          { id: 'p7q2m4cd', name: 'La Centrale', enabled: false },
        ],
        notifications: { push: true, telegramChatId: '100000001' },
      });
      expect(devices.map((device) => device.json())).toEqual([
        { authenticated: true, needsSetup: false, setupCodeRequired: false },
        { authenticated: true, needsSetup: false, setupCodeRequired: false },
        { authenticated: true, needsSetup: false, setupCodeRequired: false },
      ]);
    }));

  it('après la mise à jour, la lecture de la boîte mail et des sources reprend là où la base héritée s’était arrêtée', () =>
    onUpdatedLegacyDatabase(async ({ ports }) => {
      // Arrange
      const montauban = { city: 'Montauban', postalCode: '82000' };

      // Act
      const emails = ports.mailboxState.recentlyProcessed(60);
      const place = await ports.geocoder.locate(montauban);

      // Assert
      expect(ports.mailboxState.position('INBOX')).toEqual({ lastUid: 189, uidValidity: 1 });
      expect(ports.mailboxState.isProcessed('<0100019a709cb354-lc@mail-alerte.lacentrale.fr>')).toBe(true);
      expect(emails).toHaveLength(17);
      expect(emails.find((e) => e.subject === '61 nouveaux véhicules correspondent à votre recherche')?.summary).toMatchObject({
        announced: 61,
        kind: 'new',
        moreUrl: 'https://www.lacentrale.fr/listing?customerFamilyCodes=PART',
        listings: [{ title: 'VOLKSWAGEN COCCINELLE' }, { title: 'OPEL MERIVA II phase 2' }, { title: 'LAND ROVER DISCOVERY SPORT' }],
      });
      expect(emails.find((e) => e.error !== null)).toMatchObject({ messageId: 'uid-1-144', error: 'Command failed', summary: null });
      expect(ports.sourceRuns.all().map((r) => [r.source, r.ok])).toEqual([
        ['http:p7q2m4cd', false],
        ['email', true],
        ['http:k3v9x2ab', true],
      ]);
      expect(ports.subscriptions.all().map((s) => new URL(s.endpoint).hostname)).toEqual(['fcm.googleapis.com', 'web.push.apple.com']);
      expect(place).toEqual({ lat: 44.0176, lon: 1.3756, precision: 'city' });
    }));

  it('le mot de passe choisi à la mise en route ouvre toujours l’application sur la base héritée', () =>
    onUpdatedLegacyDatabase(async ({ ports, server }) => {
      // Arrange
      const credentials = { password: LEGACY_PASSWORD };

      // Act
      const response = await server.inject({ method: 'POST', url: '/api/login', payload: credentials });

      // Assert
      expect({ status: response.statusCode, body: response.json() }).toEqual({ status: 200, body: { ok: true } });
      expect(ports.secrets.get('cookie_secret')).toHaveLength(64);
      expect(ports.secrets.get('vapid_public')).toHaveLength(87);
      expect(ports.secrets.get('vapid_private')).toHaveLength(43);
      expect(ports.secrets.get('import_token')).toHaveLength(48);
      expect(ports.secrets.get('base_url')).toBe('https://autoveille.example.com');
    }));

  it('la maintenance « Réparer » lancée sur la base héritée migrée n’y trouve rien à corriger', () =>
    inTemporaryDirectory(async (dir) => {
      // Arrange
      const file = join(dir, 'autoveille.sqlite');
      buildLegacyDatabase(file);
      await restarted(file);
      const before = snapshotOf(file);

      // Act
      const repaired = await startedOn(file, ({ ports }) => repairVehicles(ports));

      // Assert
      expect(repaired).toEqual({ vehicles: 20, renamed: 0, split: 0, reevaluated: 0 });
      expect(snapshotOf(file)).toEqual(before);
    }));
});
