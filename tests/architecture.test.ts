import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { reviewBiomeLegacyOverride } from './support/architecture/biomeLegacyOverride.js';
import { reviewExceptions } from './support/architecture/exceptions.js';
import { findViolations } from './support/architecture/findViolations.js';
import { legacyExceptions } from './support/architecture/legacy.js';
import { existsInRepository, readBiomeLegacyOverride, readSourceTree } from './support/architecture/sourceTree.js';
import type { SourceFile } from './support/architecture/violation.js';

const repositoryRoot = fileURLToPath(new URL('..', import.meta.url));

const file = (path: string, ...lines: readonly string[]): SourceFile => ({ path, text: lines.join('\n') });

const brokenRules = (...files: readonly SourceFile[]): readonly string[] =>
  findViolations(files).map((violation) => `${violation.rule} ${violation.path}:${violation.line}`);

const messagesOf = (...files: readonly SourceFile[]): readonly string[] => findViolations(files).map((violation) => violation.message);

describe('règle de dépendance', () => {
  it('un fichier du domaine qui importe better-sqlite3 est refusé', () => {
    // Given
    const identity = file('src/domain/vehicle/identity.ts', "import Database from 'better-sqlite3';");

    // When
    const messages = messagesOf(identity);

    // Then
    expect(messages).toEqual([
      "src/domain/vehicle/identity.ts:1 le domaine importe le paquet npm « better-sqlite3 » : src/domain/ n'importe que src/domain/ (et createHash de node:crypto pour l'empreinte)",
    ]);
  });

  it("l'empreinte d'un véhicule peut hacher avec createHash de node:crypto", () => {
    // Given
    const identity = file(
      'src/domain/vehicle/identity.ts',
      "import { createHash } from 'node:crypto';",
      "import type { RawListing } from './types.js';",
      "export const fingerprint = (listing: RawListing): string => createHash('sha1').update(listing.title).digest('hex');",
    );

    // When
    const broken = brokenRules(identity);

    // Then
    expect(broken).toEqual([]);
  });

  it('un identifiant tiré avec randomUUID de node:crypto dans le domaine est refusé', () => {
    // Given
    const sanitize = file('src/domain/settings/sanitize.ts', "import { randomUUID } from 'node:crypto';");

    // When
    const messages = messagesOf(sanitize);

    // Then
    expect(messages).toEqual([
      "src/domain/settings/sanitize.ts:1 le domaine importe le module Node « node:crypto » (randomUUID) : src/domain/ n'importe que src/domain/ (et createHash de node:crypto pour l'empreinte)",
    ]);
  });

  it('des gabarits de messages lus sur le disque avec node:fs depuis le domaine sont refusés', () => {
    // Given
    const defaults = file(
      'src/domain/settings/defaultTemplates.ts',
      "import { readFileSync } from 'node:fs';",
      "export const defaultTemplates = readFileSync('templates.json', 'utf8');",
    );

    // When
    const broken = brokenRules(defaults);

    // Then
    expect(broken).toEqual(['domainDependency src/domain/settings/defaultTemplates.ts:1']);
  });

  it("une règle du domaine qui réutilise l'ancien src/listings/normalize.ts est refusée", () => {
    // Given
    const price = file('src/domain/parsing/price.ts', "import { parsePrice } from '../../listings/normalize.js';");

    // When
    const messages = messagesOf(price);

    // Then
    expect(messages).toHaveLength(1);
    expect(messages[0]).toContain(
      'src/domain/parsing/price.ts:1 le domaine importe « ../../listings/normalize.js » (src/listings/normalize.js)',
    );
  });

  it('un ré-export de la distance depuis un adaptateur dans le domaine est refusé', () => {
    // Given
    const distance = file(
      'src/domain/geo/distance.ts',
      "export { haversineKm } from '../../infrastructure/http/offlineGeo.js';",
      "export * from '../../infrastructure/http/offlineGeo.js';",
    );

    // When
    const broken = brokenRules(distance);

    // Then
    expect(broken).toEqual(['domainDependency src/domain/geo/distance.ts:1', 'domainDependency src/domain/geo/distance.ts:2']);
  });

  it("un type de ligne SQL repris par import('better-sqlite3') dans le domaine est refusé", () => {
    // Given
    const types = file('src/domain/vehicle/types.ts', "export type VehicleRow = import('better-sqlite3').Statement;");

    // When
    const broken = brokenRules(types);

    // Then
    expect(broken).toEqual(['domainDependency src/domain/vehicle/types.ts:1']);
  });

  it("un import() dynamique d'un adaptateur depuis le domaine est refusé", () => {
    // Given
    const decide = file(
      'src/domain/ingest/decide.ts',
      'export const decide = async () => {',
      "  const { geocode } = await import('../../infrastructure/http/geoApiGouvGeocoder.js');",
      '  return geocode;',
      '};',
    );

    // When
    const broken = brokenRules(decide);

    // Then
    expect(broken).toEqual(['domainDependency src/domain/ingest/decide.ts:2']);
  });

  it('un use case qui lit la base SQLite directement est refusé', () => {
    // Given
    const listVehicles = file(
      'src/application/vehicles/listVehicles.ts',
      "import { createVehicleRepository } from '../../infrastructure/persistence/sqlite/vehicleRepository.js';",
    );

    // When
    const messages = messagesOf(listVehicles);

    // Then
    expect(messages).toEqual([
      "src/application/vehicles/listVehicles.ts:1 l'application importe « ../../infrastructure/persistence/sqlite/vehicleRepository.js » (src/infrastructure/persistence/sqlite/vehicleRepository.js) : src/application/ n'importe que src/application/ et src/domain/",
    ]);
  });

  it('un use case qui charge le dépôt SQLite par import = require est refusé', () => {
    // Given
    const listVehicles = file(
      'src/application/vehicles/listVehicles.ts',
      "import repository = require('../../infrastructure/persistence/sqlite/vehicleRepository.js');",
      "import type rows = require('../../infrastructure/persistence/sqlite/rows.js');",
    );

    // When
    const broken = brokenRules(listVehicles);

    // Then
    expect(broken).toEqual([
      'applicationDependency src/application/vehicles/listVehicles.ts:1',
      'applicationDependency src/application/vehicles/listVehicles.ts:2',
    ]);
  });

  it('un use case qui renvoie un DTO de src/shared/api.ts est refusé', () => {
    // Given
    const getVehicle = file('src/application/vehicles/getVehicle.ts', "import type { VehicleDto } from '../../shared/api.js';");

    // When
    const broken = brokenRules(getVehicle);

    // Then
    expect(broken).toEqual(['applicationDependency src/application/vehicles/getVehicle.ts:1']);
  });

  it('un use case qui lit la boîte avec imapflow au lieu du port MailboxReader est refusé', () => {
    // Given
    const pollMailbox = file('src/application/ingest/pollMailbox.ts', "import { ImapFlow } from 'imapflow';");

    // When
    const broken = brokenRules(pollMailbox);

    // Then
    expect(broken).toEqual(['applicationDependency src/application/ingest/pollMailbox.ts:1']);
  });

  it("un import() au chemin calculé dans l'application est refusé car invérifiable", () => {
    // Given
    const fetchHttpSites = file(
      'src/application/sources/fetchHttpSites.ts',
      `export const load = (site: string) => import(\`../sites/\${site}.js\`);`,
    );

    // When
    const messages = messagesOf(fetchHttpSites);

    // Then
    expect(messages).toHaveLength(1);
    expect(messages[0]).toContain(`l'application importe un module au chemin non vérifiable \`../sites/\${site}.js\``);
  });

  it('un use case qui passe par un port et une règle du domaine est accepté', () => {
    // Given
    const ingestListing = file(
      'src/application/ingest/ingestListing.ts',
      "import type { VehicleRepository } from '../ports/vehicleRepository.js';",
      "import { decide } from '../../domain/ingest/decide.js';",
      "export { notifyNewVehicle } from '../notifications/notifyNewVehicle.js';",
    );

    // When
    const broken = brokenRules(ingestListing);

    // Then
    expect(broken).toEqual([]);
  });

  it("l'adaptateur IMAP qui importe le dépôt SQLite est refusé", () => {
    // Given
    const imapReader = file(
      'src/infrastructure/email/imap/imapMailboxReader.ts',
      "import { createMailboxStateRepository } from '../../persistence/sqlite/mailboxStateRepository.js';",
    );

    // When
    const messages = messagesOf(imapReader);

    // Then
    expect(messages).toEqual([
      "src/infrastructure/email/imap/imapMailboxReader.ts:1 l'adaptateur « email » importe l'adaptateur « persistence » « ../../persistence/sqlite/mailboxStateRepository.js » (src/infrastructure/persistence/sqlite/mailboxStateRepository.js) : un adaptateur ne connaît pas les autres adaptateurs",
    ]);
  });

  it('un dépôt SQLite qui importe son mapper, son port, le domaine, better-sqlite3 et node:path est accepté', () => {
    // Given
    const repository = file(
      'src/infrastructure/persistence/sqlite/vehicleRepository.ts',
      "import { join } from 'node:path';",
      "import Database from 'better-sqlite3';",
      "import type { VehicleRepository } from '../../../application/ports/vehicleRepository.js';",
      "import type { Vehicle } from '../../../domain/vehicle/types.js';",
      "import type { VehicleDto } from '../../../shared/api.js';",
      "import { vehicleFromRow } from './mappers.js';",
    );

    // When
    const broken = brokenRules(repository);

    // Then
    expect(broken).toEqual([]);
  });

  it('une route web qui va chercher la composition dans main.ts est refusée', () => {
    // Given
    const route = file('src/infrastructure/web/routes/vehicles.ts', "import { compose } from '../../../main.js';");

    // When
    const messages = messagesOf(route);

    // Then
    expect(messages).toHaveLength(1);
    expect(messages[0]).toContain("l'infrastructure importe « ../../../main.js » (src/main.js)");
  });

  it('src/shared/api.ts qui exporte la taille de page en constante est refusé', () => {
    // Given
    const api = file('src/shared/api.ts', 'export const PAGE_SIZE = 50;');

    // When
    const messages = messagesOf(api);

    // Then
    expect(messages).toEqual([
      'src/shared/api.ts:1 déclaration exécutable « export const PAGE_SIZE = 50; » : src/shared/ ne contient que des types et des interfaces',
    ]);
  });

  it('src/shared/api.ts qui reprend le statut du domaine est refusé', () => {
    // Given
    const api = file(
      'src/shared/api.ts',
      "import type { Status } from '../domain/vehicle/types.js';",
      'export type VehicleDto = { readonly status: Status };',
    );

    // When
    const broken = brokenRules(api);

    // Then
    expect(broken).toEqual(['sharedTypesOnly src/shared/api.ts:1']);
  });

  it("src/shared/ fait seulement de types, d'interfaces, d'import type et d'export type entre eux est accepté", () => {
    // Given
    const page = file(
      'src/shared/page.ts',
      'type Cursor = string;',
      'export type Page<Item> = { readonly items: readonly Item[]; readonly nextCursor: Cursor | null };',
      'export type { Cursor };',
    );
    const api = file(
      'src/shared/api.ts',
      "import type { Page } from './page.js';",
      "export type Status = 'nouveau' | 'contacte' | 'repondu' | 'ignore';",
      'export interface VehicleDto {',
      '  readonly id: number;',
      '  readonly status: Status;',
      '}',
      'export type VehiclePage = Page<VehicleDto>;',
      "export type { Cursor } from './page.js';",
    );

    // When
    const broken = brokenRules(page, api);

    // Then
    expect(broken).toEqual([]);
  });

  it('un écran du client qui appelle directement un use case du serveur est refusé', () => {
    // Given
    const annonces = file(
      'client/src/screens/Annonces.tsx',
      "import { listVehicles } from '../../../src/application/vehicles/listVehicles.js';",
    );

    // When
    const messages = messagesOf(annonces);

    // Then
    expect(messages).toHaveLength(1);
    expect(messages[0]).toContain(
      'client/src/screens/Annonces.tsx:1 le client importe « ../../../src/application/vehicles/listVehicles.js » (src/application/vehicles/listVehicles.js)',
    );
  });

  it('le client typé par les DTO de src/shared avec import type est accepté', () => {
    // Given
    const apiClient = file(
      'client/src/api/client.ts',
      "import { signal } from '@preact/signals';",
      "import type { VehicleDto } from '../../../src/shared/api.js';",
      "import { formatPrice } from '../format/price.js';",
    );

    // When
    const broken = brokenRules(apiClient);

    // Then
    expect(broken).toEqual([]);
  });

  it('le client qui importe src/shared sans import type est refusé', () => {
    // Given
    const apiClient = file('client/src/api/client.ts', "import { type VehicleDto } from '../../../src/shared/api.js';");

    // When
    const messages = messagesOf(apiClient);

    // Then
    expect(messages).toHaveLength(1);
    expect(messages[0]).toContain('sans « import type »');
  });

  it('main.ts et la CLI câblent les adaptateurs', () => {
    // Given
    const main = file('src/main.ts', "import { loadConfig } from './infrastructure/config/loadConfig.js';");
    const demo = file('src/cli/demo.ts', "import { openDatabase } from '../infrastructure/persistence/sqlite/connection.js';");

    // When
    const broken = brokenRules(main, demo);

    // Then
    expect(broken).toEqual([]);
  });
});

describe('état global', () => {
  it('un cache Map au niveau module est un état global', () => {
    // Given
    const brands = file(
      'src/domain/catalog/brands.ts',
      'const customCache = new Map<string, readonly RegExp[]>();',
      'export const compiledPatterns = (key: string) => customCache.get(key);',
    );

    // When
    const messages = messagesOf(brands);

    // Then
    expect(messages).toEqual([
      'src/domain/catalog/brands.ts:1 « const customCache = new Map(…) » au niveau module : état global (cache compris), à construire dans une fonction (la fonction main de main.ts comprise)',
    ]);
  });

  it('une table de mots new Set au niveau module est aussi un état global', () => {
    // Given
    const location = file('src/domain/parsing/location.ts', "const LOCATION_STOP_WORDS = new Set(['particulier', 'pro', 'annonce']);");

    // When
    const broken = brokenRules(location);

    // Then
    expect(broken).toEqual(['globalState src/domain/parsing/location.ts:1']);
  });

  it('un fetch remplaçable rangé dans un let au niveau module est un état global', () => {
    // Given
    const geocoder = file(
      'src/infrastructure/http/geoApiGouvGeocoder.ts',
      'let fetchImpl: typeof fetch = globalThis.fetch;',
      'export var lastCity = "";',
    );

    // When
    const broken = brokenRules(geocoder);

    // Then
    expect(broken).toEqual([
      'globalState src/infrastructure/http/geoApiGouvGeocoder.ts:1',
      'globalState src/infrastructure/http/geoApiGouvGeocoder.ts:2',
    ]);
  });

  it('un cache de géocodage new Map() maquillé par as dans un adaptateur reste un état global', () => {
    // Given
    const geocoder = file('src/infrastructure/http/geoApiGouvGeocoder.ts', 'const geoCache = new Map<string, Coordinates>() as GeoCache;');

    // When
    const broken = brokenRules(geocoder);

    // Then
    expect(broken).toEqual(['globalState src/infrastructure/http/geoApiGouvGeocoder.ts:1']);
  });

  it("une Map construite à l'intérieur d'une fonction n'est pas un état global", () => {
    // Given
    const regroup = file(
      'src/domain/ingest/regroup.ts',
      'export const countByFingerprint = (fingerprints: readonly string[]): ReadonlyMap<string, number> => {',
      '  const counts = new Map<string, number>();',
      '  for (const fingerprint of fingerprints) {',
      '    counts.set(fingerprint, (counts.get(fingerprint) ?? 0) + 1);',
      '  }',
      '  return counts;',
      '};',
    );

    // When
    const broken = brokenRules(regroup);

    // Then
    expect(broken).toEqual([]);
  });
});

describe('état global au chargement des modules', () => {
  it('la configuration lue dans process.env au chargement du module est un singleton', () => {
    // Given
    const config = file(
      'src/infrastructure/config/config.ts',
      'loadDotEnv();',
      'const env = process.env;',
      'export const config = { port: Number(env.PORT ?? 3000) };',
    );

    // When
    const messages = messagesOf(config);

    // Then
    expect(messages).toEqual([
      'src/infrastructure/config/config.ts:1 instruction « loadDotEnv(); » exécutée au chargement du module : effet de bord global, seuls src/main.ts et src/cli/ en ont',
      'src/infrastructure/config/config.ts:2 « process.env » lu au chargement du module : configuration figée en singleton, à lire dans main.ts et à passer en paramètre',
    ]);
  });

  it('un cache de géocodage exporté par défaut ou porté par un champ static est un état global', () => {
    // Given
    const geocoder = file(
      'src/infrastructure/http/geoApiGouvGeocoder.ts',
      'export class GeoCache {',
      '  static readonly entries = new Map<string, Coordinates>();',
      '  static hits = 0;',
      '}',
      'export default new Map<string, Coordinates>();',
    );

    // When
    const broken = brokenRules(geocoder);

    // Then
    expect(broken).toEqual([
      'globalState src/infrastructure/http/geoApiGouvGeocoder.ts:2',
      'globalState src/infrastructure/http/geoApiGouvGeocoder.ts:3',
      'globalState src/infrastructure/http/geoApiGouvGeocoder.ts:5',
    ]);
  });

  it('un compteur gardé dans une fermeture exécutée au chargement est un état global', () => {
    // Given
    const sanitize = file('src/domain/settings/siteIds.ts', 'export const nextSiteId = (() => { let id = 0; return () => ++id; })();');

    // When
    const broken = brokenRules(sanitize);

    // Then
    expect(broken).toEqual(['globalState src/domain/settings/siteIds.ts:1']);
  });

  it('un var déclaré dans un if au niveau module échappe à la portée des fonctions et est refusé', () => {
    // Given
    const notifications = file(
      'src/infrastructure/push/webPushChannel.ts',
      "if (typeof globalThis.navigator === 'undefined') {",
      '  var serverSide = true;',
      '}',
    );

    // When
    const broken = brokenRules(notifications);

    // Then
    expect(broken).toEqual(['globalState src/infrastructure/push/webPushChannel.ts:1']);
  });

  it("main.ts lit l'environnement et lance l'application au chargement", () => {
    // Given
    const main = file(
      'src/main.ts',
      "import { loadConfig } from './infrastructure/config/loadConfig.js';",
      'const config = loadConfig(process.env);',
      'await startApplication(config);',
    );

    // When
    const broken = brokenRules(main);

    // Then
    expect(broken).toEqual([]);
  });

  it('une Map de sessions au niveau module de main.ts est refusée, à construire dans la fonction main', () => {
    // Given
    const main = file('src/main.ts', 'const sessions = new Map<string, number>();');

    // When
    const messages = messagesOf(main);

    // Then
    expect(messages).toEqual([
      'src/main.ts:1 « const sessions = new Map(…) » au niveau module : état global (cache compris), à construire dans une fonction (la fonction main de main.ts comprise)',
    ]);
  });
});

describe('domaine et application purs', () => {
  it("l'année maximale calculée avec new Date() dans le domaine est refusée", () => {
    // Given
    const year = file('src/domain/parsing/year.ts', 'export const maxYear = (): number => new Date().getFullYear() + 1;');

    // When
    const messages = messagesOf(year);

    // Then
    expect(messages).toEqual([
      "src/domain/parsing/year.ts:1 « new Date() » dans src/domain/ : l'heure courante se lit par le port Clock et entre en paramètre",
    ]);
  });

  it("une confirmation d'alerte sans date qui retombe sur new Date() dans le domaine est refusée", () => {
    // Given
    const confirmations = file(
      'src/domain/sites/confirmations.ts',
      'export const confirmedAt = (email: { readonly date?: Date }): Date => email.date ?? new Date();',
    );

    // When
    const broken = brokenRules(confirmations);

    // Then
    expect(broken).toEqual(['impureGlobal src/domain/sites/confirmations.ts:1']);
  });

  it("l'identifiant d'un site lu directement tiré au hasard dans le domaine est refusé", () => {
    // Given
    const sanitize = file(
      'src/domain/settings/sanitize.ts',
      'export const siteId = (): string => Math.random().toString(36).slice(2, 10);',
      'export const siteUuid = (): string => crypto.randomUUID();',
      'export const siteBytes = (bytes: Uint8Array): Uint8Array => globalThis.crypto.getRandomValues(bytes);',
    );

    // When
    const broken = brokenRules(sanitize);

    // Then
    expect(broken).toEqual([
      'impureGlobal src/domain/settings/sanitize.ts:1',
      'impureGlobal src/domain/settings/sanitize.ts:2',
      'impureGlobal src/domain/settings/sanitize.ts:3',
    ]);
  });

  it('une session renouvelée avec Date.now() dans un use case est refusée', () => {
    // Given
    const renewSession = file(
      'src/application/auth/renewSession.ts',
      'export const renewSession = (token: string) => ({ token, lastSeenAt: Date.now() });',
    );

    // When
    const messages = messagesOf(renewSession);

    // Then
    expect(messages).toEqual([
      "src/application/auth/renewSession.ts:1 « Date.now » dans src/application/ : l'heure courante se lit par le port Clock et entre en paramètre",
    ]);
  });

  it('un robots.txt lu avec fetch depuis le domaine est refusé', () => {
    // Given
    const robots = file(
      'src/domain/sites/robots.ts',
      "export const readRobots = (origin: string) => fetch(new URL('/robots.txt', origin));",
      'export const readPage = (url: string) => globalThis.fetch(url);',
    );

    // When
    const broken = brokenRules(robots);

    // Then
    expect(broken).toEqual(['impureGlobal src/domain/sites/robots.ts:1', 'impureGlobal src/domain/sites/robots.ts:2']);
  });

  it("un use case qui cherche l'adresse de la boîte dans process.env est refusé", () => {
    // Given
    const pollMailbox = file(
      'src/application/ingest/pollMailbox.ts',
      'export const mailboxUser = (): string | undefined => process.env.IMAP_USER;',
      'export const mailboxHost = (): string | undefined => {',
      '  const { env } = process;',
      '  return env.IMAP_HOST;',
      '};',
    );

    // When
    const broken = brokenRules(pollMailbox);

    // Then
    expect(broken).toEqual([
      'impureGlobal src/application/ingest/pollMailbox.ts:1',
      'impureGlobal src/application/ingest/pollMailbox.ts:3',
    ]);
  });

  it("une date de mise en ligne reçue en paramètre reste permise dans le domaine, et l'horloge système dans son adaptateur", () => {
    // Given
    const decide = file(
      'src/domain/ingest/decide.ts',
      'export const publishedOn = (iso: string): Date => new Date(iso);',
      'export const isFuture = (iso: string, now: Date): boolean => Date.parse(iso) > now.getTime();',
    );
    const systemClock = file('src/infrastructure/clock/systemClock.ts', 'export const systemClock = { now: (): Date => new Date() };');

    // When
    const broken = brokenRules(decide, systemClock);

    // Then
    expect(broken).toEqual([]);
  });
});

describe('commentaires', () => {
  it("une URL dans une chaîne n'est pas un commentaire", () => {
    // Given
    const geocoder = file('src/infrastructure/http/geoApiGouvGeocoder.ts', "const endpoint = 'https://geo.api.gouv.fr/communes';");

    // When
    const broken = brokenRules(geocoder);

    // Then
    expect(broken).toEqual([]);
  });

  it("une URL dans un gabarit avec une expression n'est pas un commentaire", () => {
    // Given
    const targetedSearches = file(
      'src/domain/sites/alertSetup.ts',
      `export const searchUrl = (zip: string): string => \`https://www.lacentrale.fr/listing?zipcode=\${zip}&radius=100\`;`,
    );

    // When
    const broken = brokenRules(targetedSearches);

    // Then
    expect(broken).toEqual([]);
  });

  it("une regex qui reconnaît un lien absolu n'est pas un commentaire", () => {
    // Given
    const tracking = file(
      'src/domain/sites/tracking.ts',
      'export const isAbsoluteLink = (href: string): boolean => /^https?:\\/\\//i.test(href);',
    );

    // When
    const broken = brokenRules(tracking);

    // Then
    expect(broken).toEqual([]);
  });

  it("une URL dans le texte d'un écran Preact n'est pas un commentaire", () => {
    // Given
    const sources = file(
      'client/src/screens/Sources.tsx',
      'export const LeboncoinHelp = () => <p title="https://www.leboncoin.fr">Créez l\'alerte sur https://www.leboncoin.fr puis revenez ici.</p>;',
    );

    // When
    const broken = brokenRules(sources);

    // Then
    expect(broken).toEqual([]);
  });

  it('un JSDoc sur une fonction du domaine est refusé', () => {
    // Given
    const filters = file(
      'src/domain/filtering/evaluate.ts',
      '/** Is this vehicle "special" (supercar / collection) under the family\'s rule? */',
      'export const isSpecial = (price: number): boolean => price >= 100000;',
    );

    // When
    const messages = messagesOf(filters);

    // Then
    expect(messages).toHaveLength(1);
    expect(messages[0]).toContain('src/domain/filtering/evaluate.ts:1 commentaire interdit « /** Is this vehicle "special"');
  });

  it('un commentaire en fin de ligne après une chaîne contenant // est trouvé', () => {
    // Given
    const catalog = file(
      'src/domain/sites/catalog.ts',
      "export const manageUrl = 'https://www.leboncoin.fr/mes-recherches'; // page des alertes",
    );

    // When
    const messages = messagesOf(catalog);

    // Then
    expect(messages).toHaveLength(1);
    expect(messages[0]).toContain('« // page des alertes »');
  });

  it("un commentaire glissé dans l'expression d'un gabarit est trouvé", () => {
    // Given
    const render = file(
      'src/domain/messaging/render.ts',
      `export const greeting = (name: string): string => \`Bonjour \${/* prénom du vendeur */ name}\`;`,
    );

    // When
    const broken = brokenRules(render);

    // Then
    expect(broken).toEqual(['comment src/domain/messaging/render.ts:1']);
  });

  it('un commentaire JSX dans un écran du client est refusé', () => {
    // Given
    const rafale = file('client/src/screens/Rafale.tsx', 'export const Rafale = () => <section>{/* une annonce à la fois */}</section>;');

    // When
    const broken = brokenRules(rafale);

    // Then
    expect(broken).toEqual(['comment client/src/screens/Rafale.tsx:1']);
  });

  it('un commentaire de public/app.js est signalé comme dans le reste du code', () => {
    // Given
    const app = file('public/app.js', '// ---------- utilitaires ----------', "const $app = document.getElementById('app');");

    // When
    const broken = brokenRules(app);

    // Then
    expect(broken).toEqual(['comment public/app.js:1']);
  });

  it('les marqueurs Given, When et Then dans un test sont permis', () => {
    // Given
    const priceTest = file(
      'tests/domain/parsing/price.test.ts',
      "it('un email AutoScout24 où le prix est collé au kilométrage', () => {",
      '  // Given',
      "  const text = '€ 2 000 100 000 km';",
      '  // When',
      '  const price = parsePrice(text);',
      '  // Then',
      '  expect(price).toBe(2000);',
      '});',
    );

    // When
    const broken = brokenRules(priceTest);

    // Then
    expect(broken).toEqual([]);
  });

  it('une explication en commentaire dans un test est refusée', () => {
    // Given
    const priceTest = file(
      'tests/domain/parsing/price.test.ts',
      '// AutoScout24 colle le prix au kilométrage',
      "const text = '€ 2 000 100 000 km';",
    );

    // When
    const messages = messagesOf(priceTest);

    // Then
    expect(messages).toEqual([
      'tests/domain/parsing/price.test.ts:1 commentaire interdit « // AutoScout24 colle le prix au kilométrage » : dans les tests, seuls // Arrange, // Act, // Assert, // Given, // When, // Then sont permis, tels quels',
    ]);
  });
});

describe('assertions de type', () => {
  it('un faux dépôt fabriqué avec as unknown as dans un test est refusé', () => {
    // Given
    const ingestTest = file('tests/application/ingest/ingestListing.test.ts', 'const repository = {} as unknown as VehicleRepository;');

    // When
    const messages = messagesOf(ingestTest);

    // Then
    expect(messages).toEqual([
      'tests/application/ingest/ingestListing.test.ts:1 assertion « as unknown as VehicleRepository » : « as unknown as » et « as never » sont interdits partout',
    ]);
  });

  it('un as never dans le client est refusé une seule fois', () => {
    // Given
    const apiClient = file('client/src/api/client.ts', 'export const send = (body: unknown) => post(body as never);');

    // When
    const broken = brokenRules(apiClient);

    // Then
    expect(broken).toEqual(['unsafeAssertion client/src/api/client.ts:1']);
  });

  it('des réglages forcés avec as unknown as dans le domaine ne sont signalés qu’une fois', () => {
    // Given
    const merge = file('src/domain/settings/merge.ts', 'export const mergeSettings = (stored: unknown) => stored as unknown as Settings;');

    // When
    const broken = brokenRules(merge);

    // Then
    expect(broken).toEqual(['unsafeAssertion src/domain/settings/merge.ts:1']);
  });

  it('un as unknown as glissé derrière un satisfies dans un mapper est refusé', () => {
    // Given
    const mappers = file(
      'src/infrastructure/persistence/sqlite/mappers.ts',
      'export const vehicleOf = (row: unknown) => (row as unknown satisfies unknown) as VehicleRow;',
    );

    // When
    const broken = brokenRules(mappers);

    // Then
    expect(broken).toEqual(['unsafeAssertion src/infrastructure/persistence/sqlite/mappers.ts:1']);
  });

  it('un mapper SQLite et un adaptateur IMAP peuvent typer des données externes avec as', () => {
    // Given
    const mappers = file(
      'src/infrastructure/persistence/sqlite/mappers.ts',
      'export const vehicleRowOf = (statement: Statement, id: number) => statement.get(id) as VehicleRow | undefined;',
    );
    const imapReader = file(
      'src/infrastructure/email/imap/imapMailboxReader.ts',
      'export const uidValidityOf = (mailbox: MailboxObject) => Number(mailbox.uidValidity as bigint);',
    );

    // When
    const broken = brokenRules(mappers, imapReader);

    // Then
    expect(broken).toEqual([]);
  });

  it('as const est permis dans le domaine', () => {
    // Given
    const families = file(
      'src/domain/catalog/families.ts',
      "export const FOLLOWED_FAMILIES = ['allemandes', 'italiennes', 'americaines', 'francaises'] as const;",
    );

    // When
    const broken = brokenRules(families);

    // Then
    expect(broken).toEqual([]);
  });

  it('un statut reçu converti avec as dans un use case est refusé', () => {
    // Given
    const updateVehicle = file(
      'src/application/vehicles/updateVehicle.ts',
      'export const statusOf = (input: { readonly status: string }) => input.status as Status;',
    );

    // When
    const messages = messagesOf(updateVehicle);

    // Then
    expect(messages).toEqual([
      "src/application/vehicles/updateVehicle.ts:1 assertion « as Status » : « as » n'est permis que dans src/infrastructure/ et les tests (ailleurs, seul « as const »)",
    ]);
  });

  it('une assertion <number>valeur dans le domaine est refusée', () => {
    // Given
    const price = file('src/domain/parsing/price.ts', 'export const priceOf = (raw: unknown) => <number>raw;');

    // When
    const broken = brokenRules(price);

    // Then
    expect(broken).toEqual(['typeAssertion src/domain/parsing/price.ts:1']);
  });
});

describe('placement des fichiers', () => {
  it('un nouveau utils.ts à la racine de src/ est refusé', () => {
    // Given
    const utils = file('src/utils.ts', 'export const fold = (text: string): string => text.normalize("NFD");');

    // When
    const messages = messagesOf(utils);

    // Then
    expect(messages).toEqual([
      'src/utils.ts:1 fichier hors de la disposition cible : src/ ne contient que domain/, application/, infrastructure/, shared/, cli/ et main.ts',
      'src/utils.ts:1 fichier « utils.ts » : un fichier porte un seul concept et en prend le nom, sans utils.ts ni barrel index.ts',
    ]);
  });

  it('un utils.ts glissé dans le domaine est refusé', () => {
    // Given
    const utils = file('src/domain/parsing/utils.ts', 'export const fold = (text: string): string => text.normalize("NFD");');

    // When
    const broken = brokenRules(utils);

    // Then
    expect(broken).toEqual(['placement src/domain/parsing/utils.ts:1']);
  });

  it('un barrel index.ts qui masque les modules du parsing ou des composants est refusé', () => {
    // Given
    const parsing = file('src/domain/parsing/index.ts', "export * from './price.js';");
    const components = file('client/src/components/index.tsx', "export { VehicleCard } from './VehicleCard.js';");

    // When
    const broken = brokenRules(parsing, components);

    // Then
    expect(broken).toEqual(['placement src/domain/parsing/index.ts:1', 'placement client/src/components/index.tsx:1']);
  });

  it('un test laissé à côté de son module dans src/ est refusé', () => {
    // Given
    const priceTest = file('src/domain/parsing/price.test.ts', "import { expect, it } from 'vitest';");

    // When
    const messages = messagesOf(priceTest);

    // Then
    expect(messages).toEqual(['src/domain/parsing/price.test.ts:1 test placé dans src/ : les tests vont dans tests/']);
  });

  it('un fichier que le parseur ne sait pas lire est signalé au lieu d’être ignoré', () => {
    // Given
    const km = file('src/domain/parsing/km.ts', 'export const parseKm = (text: string) => {');

    // When
    const broken = brokenRules(km);

    // Then
    expect(broken).toEqual(['syntax src/domain/parsing/km.ts:1']);
  });
});

describe('exceptions transitoires du code hérité', () => {
  it('un fichier hérité exempté de commentaires reste soumis à la règle de composition', () => {
    // Given
    const pipeline = file(
      'src/pipeline.ts',
      '// Republication sur le même site : même véhicule, statut conservé.',
      "import { createVehicleRepository } from './infrastructure/persistence/sqlite/vehicleRepository.js';",
    );

    // When
    const review = reviewExceptions(
      findViolations([pipeline]),
      [{ path: 'src/pipeline.ts', rules: ['placement', 'comment'] }],
      ['src/pipeline.ts'],
    );

    // Then
    expect(review.violations.map((violation) => violation.message)).toEqual([
      "src/pipeline.ts:2 importe l'adaptateur « ./infrastructure/persistence/sqlite/vehicleRepository.js » (src/infrastructure/persistence/sqlite/vehicleRepository.js) : seuls src/main.ts et src/cli/ importent src/infrastructure/",
    ]);
    expect(review.staleExceptions).toEqual([]);
  });

  it('une exception qui vise un fichier supprimé fait échouer le test', () => {
    // Given
    const exceptions = [{ path: 'src/geo/geo.ts', rules: ['placement', 'globalState'] }] as const;

    // When
    const review = reviewExceptions([], exceptions, ['src/domain/geo/distance.ts']);

    // Then
    expect(review.staleExceptions).toEqual(["src/geo/geo.ts n'existe plus : retirer son entrée de tests/support/architecture/legacy.ts"]);
  });

  it('une exception devenue inutile après le nettoyage du fichier fait échouer le test', () => {
    // Given
    const filters = file('src/listings/filters.ts', "export { evaluate } from '../domain/filtering/evaluate.js';");

    // When
    const review = reviewExceptions(
      findViolations([filters]),
      [{ path: 'src/listings/filters.ts', rules: ['placement', 'comment'] }],
      ['src/listings/filters.ts'],
    );

    // Then
    expect(review.violations).toEqual([]);
    expect(review.staleExceptions).toEqual([
      'src/listings/filters.ts respecte désormais la règle « comment » : la retirer de son entrée dans tests/support/architecture/legacy.ts',
    ]);
  });

  it('une entrée héritée dont on a retiré la dernière règle doit quitter la liste', () => {
    // Given
    const filters = file('src/listings/filters.ts', "export { evaluate } from '../domain/filtering/evaluate.js';");

    // When
    const review = reviewExceptions(
      findViolations([filters]),
      [{ path: 'src/listings/filters.ts', rules: [] }],
      ['src/listings/filters.ts'],
    );

    // Then
    expect(review.staleExceptions).toEqual([
      "src/listings/filters.ts n'a plus aucune règle exemptée : retirer son entrée de tests/support/architecture/legacy.ts",
    ]);
  });
});

describe('liste des exceptions et override Biome du code hérité', () => {
  it('une exception accordée à un fichier du domaine est refusée', () => {
    // Given
    const exceptions = [{ path: 'src/domain/catalog/brands.ts', rules: ['globalState'] }] as const;

    // When
    const review = reviewExceptions([], exceptions, ['src/domain/catalog/brands.ts']);

    // Then
    expect(review.invalidExceptions).toEqual([
      "src/domain/catalog/brands.ts est un emplacement de la nouvelle architecture : aucune exception n'y est permise dans tests/support/architecture/legacy.ts, corriger le fichier",
    ]);
  });

  it('deux entrées pour le même fichier hérité sont signalées', () => {
    // Given
    const exceptions = [
      { path: 'src/api.ts', rules: ['placement'] },
      { path: 'src/api.ts', rules: ['comment'] },
    ] as const;

    // When
    const review = reviewExceptions([], exceptions, ['src/api.ts']);

    // Then
    expect(review.invalidExceptions).toEqual([
      "src/api.ts a plusieurs entrées dans tests/support/architecture/legacy.ts : n'en garder qu'une",
    ]);
  });

  it('un override Biome qui relâche src/*.ts et src/cli/** engloberait le futur main.ts et la CLI réécrite', () => {
    // Given
    const includes = ['src/*.ts', 'src/cli/**', 'src/listings/**'];

    // When
    const problems = reviewBiomeLegacyOverride(includes, [], () => true);

    // Then
    expect(problems).toEqual([
      '« src/*.ts » est un motif qui engloberait du code neuf (src/main.ts, src/cli/…) : nommer les fichiers hérités un par un',
      '« src/cli/** » couvre un emplacement de la nouvelle architecture : nommer les fichiers hérités un par un',
    ]);
  });

  it("la CLI de démo réécrite, sortie de legacy.ts, doit aussi sortir de l'override Biome", () => {
    // Given
    const includes = ['src/cli/demo.ts', 'src/cli/parse-email.ts'];

    // When
    const problems = reviewBiomeLegacyOverride(includes, ['src/cli/parse-email.ts'], () => true);

    // Then
    expect(problems).toEqual([
      "« src/cli/demo.ts » n'a plus d'exception dans tests/support/architecture/legacy.ts : le retirer de l'override pour qu'il soit formaté et vérifié",
    ]);
  });
});

describe('arborescence réelle du dépôt', () => {
  it('src/, client/, public/ et tests/ respectent les règles, exceptions transitoires comprises', () => {
    // Given
    const files = readSourceTree(repositoryRoot);

    // When
    const review = reviewExceptions(
      findViolations(files),
      legacyExceptions,
      files.map((source) => source.path),
    );

    // Then
    expect(review.violations.map((violation) => violation.message)).toEqual([]);
  });

  it('chaque exception transitoire vise encore un fichier qui enfreint encore la règle exemptée', () => {
    // Given
    const files = readSourceTree(repositoryRoot);

    // When
    const review = reviewExceptions(
      findViolations(files),
      legacyExceptions,
      files.map((source) => source.path),
    );

    // Then
    expect(review.staleExceptions).toEqual([]);
  });

  it('la liste des exceptions ne vise que du code hérité, une seule fois par fichier', () => {
    // Given
    const files = readSourceTree(repositoryRoot);

    // When
    const review = reviewExceptions(
      findViolations(files),
      legacyExceptions,
      files.map((source) => source.path),
    );

    // Then
    expect(review.invalidExceptions).toEqual([]);
  });

  it("l'override Biome du code hérité ne relâche que des fichiers encore exemptés dans legacy.ts", () => {
    // Given
    const includes = readBiomeLegacyOverride(repositoryRoot);

    // When
    const problems = reviewBiomeLegacyOverride(
      includes,
      legacyExceptions.map((exception) => exception.path),
      existsInRepository(repositoryRoot),
    );

    // Then
    expect(includes).not.toEqual([]);
    expect(problems).toEqual([]);
  });
});
