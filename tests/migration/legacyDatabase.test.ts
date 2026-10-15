import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import Database from 'better-sqlite3';
import { describe, expect, it } from 'vitest';
import { verifyPassword } from '../../src/auth.js';
import { Store } from '../../src/db.js';
import { Pipeline } from '../../src/pipeline.js';
import { buildLegacyDatabase, LEGACY_PASSWORD, LEGACY_SESSION_TOKENS } from '../fixtures/db/buildLegacyDatabase.js';

const LEGACY_SCHEMA = readFileSync(new URL('../fixtures/db/schema-legacy.sql', import.meta.url), 'utf8');

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

const reasonsOf = (json: string): readonly string[] => {
  const reasons: unknown = JSON.parse(json);
  return Array.isArray(reasons) ? reasons.filter((reason): reason is string => typeof reason === 'string') : [];
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

describe('base de production héritée (schéma de Store.migrate avant la refonte)', () => {
  it('le schéma de référence est celui que crée le Store actuel', () => {
    // Arrange
    const store = new Store(':memory:');
    const legacy = new Database(':memory:');

    // Act
    legacy.exec(LEGACY_SCHEMA);

    // Assert
    expect(describeSchema(legacy)).toEqual(describeSchema(store.db));
    legacy.close();
    store.db.close();
  });

  it('le Store actuel ouvre la base héritée sans rien y changer', () =>
    inTemporaryDirectory((dir) => {
      // Arrange
      const file = join(dir, 'autoveille.sqlite');
      buildLegacyDatabase(file);
      const before = snapshotOf(file);

      // Act
      new Store(file).db.close();

      // Assert
      expect(snapshotOf(file)).toEqual(before);
    }));

  it('la base héritée de test s’ouvre avec le Store actuel et en relit les véhicules, les réglages et les sessions', () =>
    inTemporaryDirectory((dir) => {
      // Arrange
      const file = join(dir, 'autoveille.sqlite');
      buildLegacyDatabase(file);

      // Act
      const store = new Store(file);

      // Assert
      const vehicles = store.allVehicles();
      expect(vehicles.map((v) => v.id)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 17, 18, 19, 20, 21]);
      expect(countOf(vehicles.map((v) => v.status))).toEqual({ nouveau: 15, contacte: 2, repondu: 1, ignore: 2 });
      expect(
        store
          .listVehicles({ status: 'tous' })
          .map((v) => v.id)
          .sort((a, b) => a - b),
      ).toEqual([1, 2, 3, 5, 6, 8, 11, 12, 21]);
      expect(vehicles.filter((v) => v.matched === 0).map((v) => [v.id, reasonsOf(v.reasons)])).toEqual([
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
      expect(store.getVehicle(2)).toMatchObject({
        status: 'repondu',
        reposted: 1,
        note: 'A répondu le 17/09 : visite prévue mardi à 14 h, carnet d’entretien complet.',
        message_override: expect.stringContaining('Je suis Camille, de Démo Automobiles à Bordeaux.'),
      });
      expect(store.getVehicle(8)).toMatchObject({ status: 'ignore', do_not_contact: 1 });
      expect(store.getVehicle(12)).toMatchObject({ status: 'contacte', matched: 1, reasons: '[]' });
      expect(store.listingsOfVehicle(2).map((l) => l.external_id)).toEqual(['69112345678', '69112345999']);
      expect(store.listingsOfVehicle(3).map((l) => l.site)).toEqual(['paruvendu', 'leboncoin']);
      expect(store.priceHistory(1)).toEqual([
        { price: 112900, seen_at: '2026-09-15T07:12:04.512Z' },
        { price: 109900, seen_at: '2026-09-22T07:52:40.087Z' },
      ]);
      expect(store.priceHistory(11).map((p) => p.price)).toEqual([24900, 25900]);
      expect(store.events(6).map((e) => e.type)).toEqual(['statut_nouveau', 'notification_echec', 'nouveau']);
      expect(store.lastEventAt(2, 'statut_repondu')).toBe('2026-09-17T14:22:03.660Z');
      expect(new Set(vehicles.flatMap((v) => store.events(v.id).map((e) => e.type)))).toEqual(
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
      expect(vehicles.filter((v) => v.published_at === null).map((v) => v.id)).toEqual([15, 21]);
      expect(store.getSettings()).toMatchObject({
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
      expect(LEGACY_SESSION_TOKENS.map((token) => store.hasSession(token))).toEqual([true, true, true]);
      store.db.close();
    }));

  it('après la mise à jour, la lecture de la boîte mail et des sources reprend là où la base héritée s’était arrêtée', () =>
    inTemporaryDirectory((dir) => {
      // Arrange
      const file = join(dir, 'autoveille.sqlite');
      buildLegacyDatabase(file);

      // Act
      const store = new Store(file);

      // Assert
      expect(store.mailState('INBOX')).toEqual({ last_uid: 189, uid_validity: 1 });
      expect(store.emailProcessed('<0100019a709cb354-lc@mail-alerte.lacentrale.fr>')).toBe(true);
      const emails = store.recentEmails(60);
      expect(emails).toHaveLength(17);
      const digest = emails.find((e) => e.subject === '61 nouveaux véhicules correspondent à votre recherche');
      const parsed: unknown = JSON.parse(digest?.parsed_json ?? 'null');
      expect(parsed).toMatchObject({
        announced: 61,
        kind: 'new',
        moreUrl: 'https://www.lacentrale.fr/listing?customerFamilyCodes=PART',
        listings: [{ title: 'VOLKSWAGEN COCCINELLE' }, { title: 'OPEL MERIVA II phase 2' }, { title: 'LAND ROVER DISCOVERY SPORT' }],
      });
      expect(emails.find((e) => e.error !== null)).toMatchObject({ message_id: 'uid-1-144', error: 'Command failed', parsed_json: null });
      expect(store.sourceRuns().map((r) => [r.source, r.ok])).toEqual([
        ['http:p7q2m4cd', 0],
        ['email', 1],
        ['http:k3v9x2ab', 1],
      ]);
      expect(store.pushSubscriptions().map((s) => new URL(s.endpoint).hostname)).toEqual(['fcm.googleapis.com', 'web.push.apple.com']);
      expect(store.geoGet('montauban|82000')).toEqual({ lat: 44.0176, lon: 1.3756, precision: 'ville', source: 'api' });
      store.db.close();
    }));

  it('le mot de passe choisi à la mise en route ouvre toujours l’application sur la base héritée', () =>
    inTemporaryDirectory((dir) => {
      // Arrange
      const file = join(dir, 'autoveille.sqlite');
      buildLegacyDatabase(file);

      // Act
      const store = new Store(file);

      // Assert
      expect(verifyPassword(LEGACY_PASSWORD, store.secret('password_hash') ?? '')).toBe(true);
      expect(store.secret('cookie_secret')).toHaveLength(64);
      expect(store.secret('vapid_public')).toHaveLength(87);
      expect(store.secret('vapid_private')).toHaveLength(43);
      expect(store.secret('import_token')).toHaveLength(48);
      expect(store.secret('base_url')).toBe('https://autoveille.example.com');
      store.db.close();
    }));

  it('la maintenance « Réparer » lancée sur la base héritée n’y trouve rien à corriger', () =>
    inTemporaryDirectory(async (dir) => {
      // Arrange
      const file = join(dir, 'autoveille.sqlite');
      buildLegacyDatabase(file);
      const before = snapshotOf(file);
      const store = new Store(file);

      // Act
      const repaired = await new Pipeline(store).repair(store.getSettings());
      store.db.close();

      // Assert
      expect(repaired).toEqual({ vehicles: 20, renamed: 0, split: 0, reevaluated: 0 });
      expect(snapshotOf(file)).toEqual(before);
    }));
});
