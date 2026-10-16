import type {
  FamilyRulesDto,
  ProcessedEmailDto,
  SettingsDto,
  SettingsResponse,
  SiteDto,
  SourceRunDto,
  SourcesResponse,
} from '../../../src/shared/api';
import { type FakeServer, json } from './fakeServer';
import { serverForSignedInDealer } from './testApplication';

const family: FamilyRulesDto = { enabled: true, brands: [], known: [], minPrice: 0, maxYear: 0, keywords: [] };

export const bordeauxDealerSettings: SettingsDto = {
  dealer: { firstName: 'Julien', lastName: 'Marchand', company: 'Autos du Sud-Ouest', city: 'Bordeaux', phone: '06 12 34 56 78' },
  zone: { city: 'Bordeaux', postalCode: '33000', lat: 44.84, lon: -0.58, radiusKm: 100 },
  maxKm: 100000,
  privateOnly: true,
  specialOnly: true,
  families: { allemandes: family, italiennes: family, americaines: family, francaises: family, autres: family },
  templates: {
    allemandes: { variants: ['Bonjour,'] },
    italiennes: { variants: ['Bonjour,'] },
    americaines: { variants: ['Bonjour,'] },
    francaises: { variants: ['Bonjour,'] },
    autres: { variants: ['Bonjour,'] },
  },
  notifications: { push: true, telegramToken: '', telegramChatId: '' },
  imap: { host: 'imap.gmail.com', port: 993, user: '', pass: '', mailbox: 'INBOX' },
  httpSites: [],
  alertsDone: { lacentrale: true },
  alerts: {},
};

export const settingsResponseOf = (settings: SettingsDto): SettingsResponse => ({
  settings,
  variables: { modele: 'Modèle de la voiture' },
  families: [{ key: 'allemandes', label: 'Allemandes' }],
});

export const leboncoinToCreate: SiteDto = {
  key: 'leboncoin',
  label: 'Leboncoin',
  searchUrl:
    'https://www.leboncoin.fr/recherche?category=2&locations=Bordeaux__44.8378_-0.5792_5000_150000&owner_type=private&mileage=min-150000',
  prefilled: true,
  manageUrl: 'https://www.leboncoin.fr/mes-recherches',
  alertRadiusKm: 150,
  alertMaxKm: 150000,
  help: 'Faites une recherche dans Véhicules > Voitures avec vos critères (marque, rayon autour de la ville, kilométrage, vendeur particulier), puis « Sauvegarder la recherche » et activez l’alerte par email.',
  done: false,
  alert: null,
  issues: [],
  advice: null,
  digest: null,
  targeted: [],
};

const laCentraleTargetedSearch = (label: string, brands: string, minPrice: number) => ({
  label,
  url: `https://www.lacentrale.fr/listing?makesModelsCommercialNames=${brands}&priceMin=${minPrice}&customerFamilyCodes=PART&distance=5&dptCp=33000&mileageMax=150000&sortBy=firstOnlineDateDesc`,
  brands: brands.split('%3B'),
  minPrice,
});

export const laCentraleConfirmedTooNarrow: SiteDto = {
  key: 'lacentrale',
  label: 'La Centrale',
  searchUrl: 'https://www.lacentrale.fr/listing?customerFamilyCodes=PART&dptCp=33000&mileageMax=150000',
  prefilled: true,
  manageUrl: 'https://www.lacentrale.fr/compte/notification/recherche',
  alertRadiusKm: 150,
  alertMaxKm: 150000,
  help: 'Lancez une recherche avec vos critères, puis « Créer une alerte » (compte gratuit) et choisissez la réception par email à chaque nouvelle annonce.',
  done: true,
  alert: {
    site: 'lacentrale',
    criteria: '80 000 km max, 33000 (rayon de 50 km), particuliers',
    confirmedAt: '2026-10-12T17:42:05.000Z',
    manageUrl: 'https://www.lacentrale.fr/compte/notification/recherche',
    radiusKm: 50,
    maxKm: 80000,
    postalCode: '33000',
    sellerType: 'particulier',
  },
  issues: [
    'L’alerte du site ne couvre que 50 km autour de la ville, vos réglages vont jusqu’à 100 km : les annonces entre les deux n’arriveront jamais.',
    'L’alerte du site s’arrête à 80 000 km au compteur, vos réglages acceptent jusqu’à 100 000 km.',
  ],
  advice:
    'Cette alerte est réglée au plus juste. Vous pouvez l’élargir (150 km de rayon, 150 000 km au compteur) : l’application garde votre tri, et les annonces écartées restent consultables au cas où une bonne affaire s’y cache.',
  digest: {
    at: '2026-10-13T09:58:12.000Z',
    announced: 61,
    received: 2,
    url: 'https://www.lacentrale.fr/listing?customerFamilyCodes=PART',
    subject: '61 nouveaux véhicules correspondent à votre recherche',
  },
  targeted: [
    laCentraleTargetedSearch('Porsche à partir de 30 000 €', 'PORSCHE', 30000),
    laCentraleTargetedSearch('Mercedes-Benz à partir de 30 000 €', 'MERCEDES', 30000),
    laCentraleTargetedSearch('Ferrari, Lamborghini, Maserati à partir de 20 000 €', 'FERRARI%3BLAMBORGHINI%3BMASERATI', 20000),
    laCentraleTargetedSearch('Alpine, Bugatti, Renault à partir de 35 000 €', 'ALPINE%3BBUGATTI%3BRENAULT', 35000),
  ],
};

export const autoscout24ToCreate: SiteDto = {
  ...leboncoinToCreate,
  key: 'autoscout24',
  label: 'AutoScout24',
  searchUrl: 'https://www.autoscout24.fr/lst?custtype=P&kmto=150000&zip=33000&zipr=150&cy=F&atype=C',
  manageUrl: 'https://www.autoscout24.fr/account/searches',
  help: 'Après une recherche, utilisez « Sauver la recherche », puis dans Mon AutoScout24 > Recherches sauvegardées, activez « Alertez-moi par e-mail » (il est désactivé par défaut).',
};

export const paruvenduToCreate: SiteDto = {
  ...leboncoinToCreate,
  key: 'paruvendu',
  label: 'ParuVendu',
  searchUrl:
    'https://www.paruvendu.fr/auto-moto/listefo/default/default?reaf=1&codeINSEE=33063%2C&ray=150&r=VVO00000&km1=150000&codPro=off',
  manageUrl: 'https://www.paruvendu.fr/utilisateurparticulierfo/default/accueilCompte/',
  help: 'Depuis la liste de résultats, cliquez « Créer une alerte » et renseignez l’adresse email dédiée.',
};

export const largusOptional: SiteDto = {
  ...leboncoinToCreate,
  key: 'largus',
  label: 'L’argus',
  searchUrl: 'https://occasion.largus.fr/voiture-occasion/',
  prefilled: false,
  manageUrl: undefined,
  help: 'Après une recherche, « Créer une alerte » puis choisissez la fréquence « dès qu’une annonce est publiée ».',
};

export const laCentraleSixtyOneAnnounced: ProcessedEmailDto = {
  message_id: '<alerte-61@mail-alerte.lacentrale.fr>',
  subject: '61 nouveaux véhicules correspondent à votre recherche',
  sender: 'info@mail-alerte.lacentrale.fr',
  received_at: '2026-10-13T09:58:12.000Z',
  site: 'lacentrale',
  parsed_count: 2,
  parsed: {
    listings: [
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
    ],
    pending: 0,
    ignored: 0,
    announced: 61,
    kind: 'new',
    moreUrl: 'https://www.lacentrale.fr/listing?customerFamilyCodes=PART',
  },
  error: null,
  processed_at: '2026-10-13T09:58:40.000Z',
};

export const paruvenduOneFerrari: ProcessedEmailDto = {
  message_id: '<alerte-1@paruvendu.fr>',
  subject: '🚗 1 nouvelle annonce',
  sender: 'info@paruvendu.fr',
  received_at: '2026-10-13T09:56:40.000Z',
  site: 'paruvendu',
  parsed_count: 1,
  parsed: {
    listings: [
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
    ],
    pending: 0,
    ignored: 0,
    announced: 1,
    kind: 'new',
  },
  error: null,
  processed_at: '2026-10-13T09:57:05.000Z',
};

export const leboncoinFavouritesWithoutListing: ProcessedEmailDto = {
  message_id: '<favoris-44@leboncoin.fr>',
  subject: 'Vos favoris vous attendent',
  sender: 'alerte@leboncoin.fr',
  received_at: '2026-10-13T07:30:00.000Z',
  site: 'leboncoin',
  parsed_count: 0,
  parsed: { listings: [], pending: 0, ignored: 7, kind: 'other' },
  error: null,
  processed_at: '2026-10-13T07:31:02.000Z',
};

export const emailCutByGmail: ProcessedEmailDto = {
  message_id: 'uid-1-41',
  subject: '',
  sender: '',
  received_at: null,
  site: null,
  parsed_count: 0,
  parsed: null,
  error: 'Unexpected close',
  processed_at: '2026-10-13T09:59:02.000Z',
};

export const mailboxPassWithOneError: SourceRunDto = {
  source: 'email',
  last_run_at: '2026-10-13T09:59:02.000Z',
  ok: 0,
  detail: '2 email(s) lu(s), 3 annonce(s), 2 nouvelle(s) correspondant aux réglages ; 1 erreur(s) : uid 41: Unexpected close',
};

export const sitesOf = (overrides: Partial<SourcesResponse> = {}): SourcesResponse => ({
  imap: { host: 'imap.gmail.com', port: 993, user: '', hasPassword: false, mailbox: 'INBOX', configured: false, lastRun: null },
  sites: [leboncoinToCreate, laCentraleConfirmedTooNarrow, autoscout24ToCreate, paruvenduToCreate, largusOptional],
  httpSites: [],
  emails: [],
  ...overrides,
});

export const serverForSitesScreen = (sources: SourcesResponse = sitesOf(), settings: SettingsDto = bordeauxDealerSettings): FakeServer => {
  const server = serverForSignedInDealer();
  let saved = settings;
  server.on('GET', '/api/settings', () => json(200, settingsResponseOf(saved)));
  server.on('GET', '/api/sources', () => json(200, sources));
  server.on('PUT', '/api/settings', (request) => {
    saved = { ...saved, ...(typeof request.body === 'object' ? request.body : {}) };
    return json(200, { settings: saved, preview: { pass: 12, total: 40 }, warning: null });
  });
  return server;
};
