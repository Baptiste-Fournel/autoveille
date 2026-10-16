import { brandsOfFamily } from '../catalog/brands.js';
import type { Family } from '../catalog/families.js';
import { DEFAULT_KEYWORDS } from './defaultKeywords.js';
import { DEFAULT_TEMPLATES } from './defaultTemplates.js';
import { perFamily } from './perFamily.js';
import type { FamilyRules, Settings } from './types.js';

const DEFAULT_ENABLED_BRANDS: Readonly<Record<Family, readonly string[]>> = {
  allemandes: ['Porsche', 'Mercedes-Benz', 'BMW', 'Audi', 'Alpina'],
  italiennes: ['Ferrari', 'Lamborghini', 'Maserati', 'Pagani', 'Alfa Romeo', 'Lancia', 'De Tomaso'],
  americaines: [
    'Ford',
    'Chevrolet',
    'Dodge',
    'Cadillac',
    'Chrysler',
    'Pontiac',
    'Buick',
    'Lincoln',
    'Plymouth',
    'Oldsmobile',
    'Shelby',
    'Hummer',
    'Jeep',
  ],
  francaises: ['Alpine', 'Bugatti', 'Renault', 'Peugeot', 'Citroën', 'Venturi', 'Matra', 'Facel Vega'],
  autres: [],
};

interface SpecialThresholds {
  readonly minPrice: number;
  readonly maxYear: number;
}

const DEFAULT_SPECIAL_THRESHOLDS: Readonly<Record<Family, SpecialThresholds>> = {
  allemandes: { minPrice: 40_000, maxYear: 1995 },
  italiennes: { minPrice: 30_000, maxYear: 1995 },
  americaines: { minPrice: 15_000, maxYear: 1995 },
  francaises: { minPrice: 50_000, maxYear: 1985 },
  autres: { minPrice: 0, maxYear: 0 },
};

export const DEFAULT_IMAP_PORT = 993;

const defaultFamilyRules = (family: Family): FamilyRules => ({
  enabled: family !== 'autres',
  brands: DEFAULT_ENABLED_BRANDS[family],
  known: brandsOfFamily(family),
  minPrice: DEFAULT_SPECIAL_THRESHOLDS[family].minPrice,
  maxYear: DEFAULT_SPECIAL_THRESHOLDS[family].maxYear,
  keywords: DEFAULT_KEYWORDS[family],
});

export const defaultSettings = (): Settings => ({
  dealer: { firstName: '', lastName: '', company: '', city: 'Bordeaux', phone: '' },
  zone: { city: 'Bordeaux', postalCode: '33000', lat: 44.8378, lon: -0.5792, radiusKm: 100 },
  maxKm: 100_000,
  privateOnly: true,
  specialOnly: true,
  alertsDone: {},
  alerts: {},
  families: perFamily(defaultFamilyRules),
  templates: perFamily((family) => ({ variants: DEFAULT_TEMPLATES[family].variants })),
  notifications: { push: true, telegramToken: '', telegramChatId: '' },
  imap: { host: 'imap.gmail.com', port: DEFAULT_IMAP_PORT, user: '', pass: '', mailbox: 'INBOX' },
  httpSites: [],
});
