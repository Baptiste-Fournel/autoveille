import { fileURLToPath } from 'node:url';
import { vi } from 'vitest';
import { ingestListing } from '../../src/application/ingest/ingestListing.js';
import type { EmailListingSummary } from '../../src/application/ports/mailboxStateRepository.js';
import { updateVehicle } from '../../src/application/vehicles/updateVehicle.js';
import { recordAlertConfirmation } from '../../src/domain/settings/alerts.js';
import type { AlertInfo } from '../../src/domain/settings/types.js';
import type { RawListing } from '../../src/domain/vehicle/types.js';
import { loadConfig } from '../../src/infrastructure/config/loadConfig.js';
import { imapFlowClient } from '../../src/infrastructure/email/imap/imapMailboxReader.js';
import type { WebPushClient } from '../../src/infrastructure/push/webPushChannel.js';
import { type Application, buildApplication } from '../../src/main.js';
import { OWNER_PASSWORD, SESSION_COOKIE } from '../support/authentication.js';
import { manualTimers } from '../support/manualTimers.js';
import { type SteppingClock, steppingClock } from '../support/steppingClock.js';
import { A_WEEK_BEFORE, ONE_WEEK } from './clock.js';

export type SessionCookie = 'posée' | 'effacée' | 'absente';

export interface ContractRequest {
  readonly method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  readonly url: string;
  readonly payload?: string | Readonly<Record<string, unknown>>;
  readonly contentType?: string;
  readonly session?: string;
  readonly remoteAddress?: string;
  readonly headers?: Readonly<Record<string, string>>;
}

export interface ContractResponse {
  readonly status: number;
  readonly body: unknown;
  readonly contentType: string;
  readonly cacheControl: string;
  readonly sessionCookie: SessionCookie;
  readonly cookieAttributes: string;
  readonly session: string | undefined;
}

export interface ContractApp {
  readonly request: (request: ContractRequest) => Promise<ContractResponse>;
  readonly signIn: () => Promise<string>;
  readonly vehicleIdOf: (site: string, externalId: string) => number;
  readonly storedImapPassword: () => string;
  readonly stop: () => Promise<void>;
}

export interface ContractAppOptions {
  readonly setupCode?: string;
}

const PUBLIC_DIRECTORY = fileURLToPath(new URL('../../public/', import.meta.url));

const CONTACTED_LAST_WEEK: RawListing = {
  site: 'leboncoin',
  siteLabel: 'Leboncoin',
  externalId: '2810004321',
  url: 'https://www.leboncoin.fr/ad/voitures/2810004321',
  title: 'Porsche 944 Turbo 2.5 220ch',
  price: 32900,
  km: 96000,
  year: 1986,
  city: 'Saint-Médard-en-Jalles',
  postalCode: '33160',
  sellerType: 'particulier',
};

const UNFOLLOWED_BRAND: RawListing = {
  site: 'leboncoin',
  siteLabel: 'Leboncoin',
  externalId: '2811004444',
  url: 'https://www.leboncoin.fr/ad/voitures/2811004444',
  title: 'Toyota GR Yaris 1.6 261ch',
  price: 38900,
  km: 18000,
  year: 2021,
  city: 'Mérignac',
  postalCode: '33700',
  sellerType: 'particulier',
};

const PORSCHE_911_4S: RawListing = {
  site: 'leboncoin',
  siteLabel: 'Leboncoin',
  externalId: '2811001234',
  url: 'https://www.leboncoin.fr/ad/voitures/2811001234',
  title: 'Porsche 911 Carrera 4S 3.0 450ch PDK',
  price: 112900,
  km: 42000,
  year: 2017,
  city: 'Mérignac',
  postalCode: '33700',
  sellerType: 'particulier',
};

const MERCEDES_C63: RawListing = {
  site: 'lacentrale',
  siteLabel: 'La Centrale',
  externalId: '69112345678',
  url: 'https://www.lacentrale.fr/auto-occasion-annonce-69112345678.html',
  title: 'Mercedes-AMG C63 S Coupé',
  price: 64900,
  km: 45200,
  year: 2019,
  city: 'Libourne',
  postalCode: '33500',
  sellerType: 'particulier',
};

const ALPINE_A110: RawListing = {
  site: 'autoscout24',
  siteLabel: 'AutoScout24',
  externalId: '12345678-1234-1234-1234-123456789abc',
  url: 'https://www.autoscout24.fr/annonces/alpine-a110-12345678-1234-1234-1234-123456789abc',
  title: 'Alpine A110 Légende 252ch',
  price: 58900,
  km: 21000,
  year: 2019,
  city: 'Pessac',
  postalCode: '33600',
  sellerType: 'particulier',
};

const DEMO_LISTINGS: readonly RawListing[] = [
  PORSCHE_911_4S,
  MERCEDES_C63,
  {
    site: 'paruvendu',
    siteLabel: 'ParuVendu',
    externalId: 'ABCDEF123456',
    url: 'https://www.paruvendu.fr/a/voiture-occasion/ferrari/360/ABCDEF123456',
    title: 'Ferrari 360 Modena F1',
    price: 79000,
    km: 45000,
    year: 2001,
    city: 'Langon',
    postalCode: '33210',
    sellerType: 'particulier',
  },
  {
    site: 'leboncoin',
    siteLabel: 'Leboncoin',
    externalId: '2811005678',
    url: 'https://www.leboncoin.fr/ad/voitures/2811005678',
    title: 'Ford Mustang GT 5.0 V8 Fastback',
    price: 42000,
    km: 31000,
    year: 2018,
    city: 'Arcachon',
    postalCode: '33120',
    sellerType: 'particulier',
  },
  ALPINE_A110,
  {
    site: 'leboncoin',
    siteLabel: 'Leboncoin',
    externalId: '2811009999',
    url: 'https://www.leboncoin.fr/ad/voitures/2811009999',
    title: 'BMW M3 E46 3.2 343ch',
    price: 34500,
    km: 128000,
    year: 2004,
    city: 'Bordeaux',
    postalCode: '33000',
    sellerType: 'particulier',
  },
  {
    site: 'leboncoin',
    siteLabel: 'Leboncoin',
    externalId: '2811007777',
    url: 'https://www.leboncoin.fr/ad/voitures/2811007777',
    title: 'Audi A3 Sportback 2.0 TDI 150',
    price: 21500,
    km: 48000,
    year: 2019,
    city: 'Talence',
    postalCode: '33400',
    sellerType: 'particulier',
  },
  {
    site: 'lacentrale',
    siteLabel: 'La Centrale',
    externalId: '69100000001',
    url: 'https://www.lacentrale.fr/auto-occasion-annonce-69100000001.html',
    title: 'Porsche 911 (997) Carrera S 3.8 355ch',
    price: 54900,
    km: 89000,
    year: 2006,
    city: 'Angoulême',
    postalCode: '16000',
    sellerType: 'pro',
  },
  {
    site: 'leboncoin',
    siteLabel: 'Leboncoin',
    externalId: '2811008888',
    url: 'https://www.leboncoin.fr/ad/voitures/2811008888',
    title: 'Chevrolet Corvette C7 Stingray 6.2 V8',
    price: 59000,
    km: 27000,
    year: 2016,
    city: 'Gradignan',
    postalCode: '33170',
    sellerType: 'particulier',
  },
  {
    site: 'leboncoin',
    siteLabel: 'Leboncoin',
    externalId: '2811006666',
    url: 'https://www.leboncoin.fr/ad/voitures/2811006666',
    title: 'Peugeot 205 GTI 1.9 130ch',
    price: 24900,
    km: 98000,
    year: 1990,
    city: 'Blanquefort',
    postalCode: '33290',
    sellerType: 'particulier',
  },
];

const PARUVENDU_EMAIL_LISTINGS: readonly EmailListingSummary[] = [
  {
    title: 'Ferrari 360 Modena F1',
    price: 79000,
    km: 45000,
    year: 2001,
    city: 'Langon',
    postalCode: '33210',
    sellerType: 'particulier',
    url: 'https://www.paruvendu.fr/a/voiture-occasion/ferrari/360/ABCDEF123456',
  },
];

const LACENTRALE_DIGEST_LISTINGS: readonly EmailListingSummary[] = [
  {
    title: 'Mercedes-AMG C63 S Coupé',
    price: 64900,
    km: 45200,
    year: 2019,
    city: 'Libourne',
    postalCode: '33500',
    sellerType: 'particulier',
    url: 'https://www.lacentrale.fr/auto-occasion-annonce-69112345678.html',
  },
  {
    title: 'Porsche 911 (997) Carrera S 3.8 355ch',
    price: 54900,
    km: 89000,
    year: 2006,
    city: 'Angoulême',
    postalCode: '16000',
    sellerType: 'pro',
    url: 'https://www.lacentrale.fr/auto-occasion-annonce-69100000001.html',
  },
];

const LACENTRALE_NARROW_ALERT: AlertInfo = {
  site: 'lacentrale',
  criteria: '80 000 km max, 33000 (rayon de 50 km), particuliers',
  confirmedAt: '2026-10-12T17:42:05.000Z',
  manageUrl: 'https://www.lacentrale.fr/compte/notification/recherche',
  maxKm: 80000,
  postalCode: '33000',
  radiusKm: 50,
  sellerType: 'particulier',
};

const NO_NETWORK = 'Aucun appel réseau pendant la caractérisation.';

const noNetwork: typeof fetch = () => Promise.reject(new Error(NO_NETWORK));

const noPushService: WebPushClient = { sendNotification: () => Promise.reject(new Error(NO_NETWORK)) };

const vehicleIdIn = (application: Application, site: string, externalId: string): number => {
  const known = application.ports.vehicles.findListing(site, externalId);
  if (known === undefined) {
    throw new Error(`Annonce ${site} ${externalId} absente de la base de caractérisation`);
  }
  return known.vehicle.id;
};

async function populate(application: Application, clock: SteppingClock): Promise<void> {
  const { ports } = application;
  const ingest = (listing: RawListing) => ingestListing(ports, { listing, settings: ports.settings.load(), notify: true });
  await ingest(CONTACTED_LAST_WEEK);
  const contactedLastWeek = vehicleIdIn(application, CONTACTED_LAST_WEEK.site, CONTACTED_LAST_WEEK.externalId);
  updateVehicle(ports, contactedLastWeek, { status: 'contacte' });

  clock.advanceBy(ONE_WEEK);
  for (const listing of DEMO_LISTINGS) {
    await ingest(listing);
  }
  await ingest({ ...PORSCHE_911_4S, price: 109900 });
  await ingest({
    ...MERCEDES_C63,
    externalId: '69112345999',
    url: 'https://www.lacentrale.fr/auto-occasion-annonce-69112345999.html',
  });
  ports.vehicles.applyVehicleUpdate(vehicleIdIn(application, ALPINE_A110.site, ALPINE_A110.externalId), { status: 'contacte' });
  await ingest(UNFOLLOWED_BRAND);

  updateVehicle(ports, contactedLastWeek, { status: 'repondu' });
  updateVehicle(ports, vehicleIdIn(application, 'leboncoin', '2811008888'), { status: 'ignore' });

  ports.mailboxState.recordProcessed({
    messageId: 'uid-1-41',
    uid: 41,
    subject: '',
    sender: '',
    receivedAt: null,
    site: null,
    listingCount: 0,
    summary: null,
    error: 'Unexpected close',
    processedAt: clock.now(),
  });
  ports.mailboxState.recordProcessed({
    messageId: '<alerte-1@paruvendu.fr>',
    uid: 42,
    subject: '🚗 1 nouvelle annonce',
    sender: 'info@paruvendu.fr',
    receivedAt: '2026-10-13T09:56:40.000Z',
    site: 'paruvendu',
    listingCount: 1,
    summary: { listings: PARUVENDU_EMAIL_LISTINGS, pending: 0, ignored: 0, announced: 1, kind: 'new' },
    error: null,
    processedAt: clock.now(),
  });
  ports.mailboxState.recordProcessed({
    messageId: '<alerte-61@mail-alerte.lacentrale.fr>',
    uid: 43,
    subject: '61 nouveaux véhicules correspondent à votre recherche',
    sender: 'info@mail-alerte.lacentrale.fr',
    receivedAt: '2026-10-13T09:58:12.000Z',
    site: 'lacentrale',
    listingCount: 2,
    summary: {
      listings: LACENTRALE_DIGEST_LISTINGS,
      pending: 0,
      ignored: 0,
      announced: 61,
      kind: 'new',
      moreUrl: 'https://www.lacentrale.fr/listing?customerFamilyCodes=PART',
    },
    error: null,
    processedAt: clock.now(),
  });
  ports.sourceRuns.record({
    source: 'http:k3v9q2xa',
    ok: true,
    detail: '12 annonce(s) lue(s) (données structurées). 0 nouvelle(s) correspondant aux réglages.',
    lastRunAt: clock.now(),
  });
  ports.sourceRuns.record({
    source: 'email',
    ok: false,
    detail: '2 email(s) lu(s), 3 annonce(s), 2 nouvelle(s) correspondant aux réglages ; 1 erreur(s) : uid 41: Unexpected close',
    lastRunAt: clock.now(),
  });
  ports.settings.save(recordAlertConfirmation(ports.settings.load(), LACENTRALE_NARROW_ALERT));
}

function setCookieHeaders(value: string | number | readonly string[] | undefined): readonly string[] {
  if (value === undefined) return [];
  if (typeof value === 'string') return [value];
  if (typeof value === 'number') return [String(value)];
  return value;
}

type ObservedCookie = { readonly state: SessionCookie; readonly value: string | undefined; readonly attributes: string };

function sessionCookieOf(headers: readonly string[]): ObservedCookie {
  const header = headers.find((candidate) => candidate.startsWith(`${SESSION_COOKIE}=`));
  if (header === undefined) return { state: 'absente', value: undefined, attributes: '' };
  const [pair = '', ...attributes] = header.split(';').map((part) => part.trim());
  const value = pair.slice(SESSION_COOKIE.length + 1);
  const attributeText = attributes.join('; ');
  return value === ''
    ? { state: 'effacée', value: undefined, attributes: attributeText }
    : { state: 'posée', value, attributes: attributeText };
}

function headerText(value: string | number | readonly string[] | undefined): string {
  return setCookieHeaders(value).join(', ');
}

export async function startContractApp(options: ContractAppOptions = {}): Promise<ContractApp> {
  vi.stubEnv('TZ', 'Europe/Paris');
  const clock = steppingClock(A_WEEK_BEFORE);
  const application = await buildApplication({
    config: loadConfig({ environment: { SETUP_CODE: options.setupCode ?? '' }, dotEnv: '', workingDirectory: '/srv/autoveille' }),
    databaseFile: ':memory:',
    staticDirectory: PUBLIC_DIRECTORY,
    clock,
    fetch: noNetwork,
    imapClient: imapFlowClient,
    webPush: noPushService,
    timers: manualTimers(),
    logging: false,
  });
  await application.start();
  await populate(application, clock);

  const request = async (call: ContractRequest): Promise<ContractResponse> => {
    const headers: Record<string, string> = { ...call.headers };
    if (call.contentType !== undefined) headers['content-type'] = call.contentType;
    if (call.session !== undefined) headers.cookie = `${SESSION_COOKIE}=${call.session}`;
    const response = await application.server.inject({
      method: call.method,
      url: call.url,
      headers,
      ...(call.payload === undefined ? {} : { payload: call.payload }),
      ...(call.remoteAddress === undefined ? {} : { remoteAddress: call.remoteAddress }),
    });
    const contentType = headerText(response.headers['content-type']);
    const body: unknown = contentType.startsWith('application/json') ? JSON.parse(response.payload) : response.payload;
    const cookie = sessionCookieOf(setCookieHeaders(response.headers['set-cookie']));
    return {
      status: response.statusCode,
      body,
      contentType,
      cacheControl: headerText(response.headers['cache-control']),
      sessionCookie: cookie.state,
      cookieAttributes: cookie.attributes,
      session: cookie.value,
    };
  };

  const signIn = async (): Promise<string> => {
    const response = await request({ method: 'POST', url: '/api/setup', payload: { password: OWNER_PASSWORD } });
    if (response.session === undefined) throw new Error(`Première connexion refusée (${response.status})`);
    return response.session;
  };

  const stop = async (): Promise<void> => {
    await application.stop();
    vi.unstubAllEnvs();
  };

  return {
    request,
    signIn,
    vehicleIdOf: (site, externalId) => vehicleIdIn(application, site, externalId),
    storedImapPassword: () => application.ports.settings.load().imap.pass,
    stop,
  };
}
