import type { FastifySchema } from 'fastify';
import { ALL_FAMILIES } from '../../../domain/catalog/families.js';

type JsonSchema = Readonly<Record<string, unknown>>;

type Fields = Readonly<Record<string, JsonSchema>>;

const TEXT: JsonSchema = { type: 'string' };

const NUMBER: JsonSchema = { type: 'number' };

const NUMBER_OR_NOTHING: JsonSchema = { type: ['number', 'null'] };

const FLAG: JsonSchema = { type: 'boolean' };

const TEXTS: JsonSchema = { type: 'array', items: TEXT };

const ALERT_SELLER_TYPES: readonly string[] = ['particulier', 'pro', 'tous'];

const knownFieldsOnly = (fields: Fields, required: readonly string[]): JsonSchema => ({
  type: 'object',
  properties: fields,
  propertyNames: { enum: Object.keys(fields) },
  ...(required.length > 0 ? { required } : {}),
});

const everyFieldRequired = (fields: Fields): JsonSchema => knownFieldsOnly(fields, Object.keys(fields));

const eachFamily = (schema: JsonSchema): JsonSchema =>
  everyFieldRequired(Object.fromEntries(ALL_FAMILIES.map((family) => [family, schema])));

const DEALER = everyFieldRequired({ firstName: TEXT, lastName: TEXT, company: TEXT, city: TEXT, phone: TEXT });

const ZONE = everyFieldRequired({ city: TEXT, postalCode: TEXT, lat: NUMBER_OR_NOTHING, lon: NUMBER_OR_NOTHING, radiusKm: NUMBER });

const FAMILY_RULES = everyFieldRequired({ enabled: FLAG, brands: TEXTS, known: TEXTS, minPrice: NUMBER, maxYear: NUMBER, keywords: TEXTS });

const MESSAGE_TEMPLATE = everyFieldRequired({ variants: TEXTS });

const NOTIFICATIONS = everyFieldRequired({ push: FLAG, telegramToken: TEXT, telegramChatId: TEXT });

const MAILBOX = everyFieldRequired({ host: TEXT, port: NUMBER, user: TEXT, pass: TEXT, mailbox: TEXT });

const HTTP_SITE = knownFieldsOnly(
  {
    id: { type: 'string', default: '' },
    name: { type: 'string', default: '' },
    url: TEXT,
    enabled: { type: 'boolean', default: true },
  },
  ['url'],
);

const ALERT = knownFieldsOnly(
  {
    site: TEXT,
    criteria: TEXT,
    confirmedAt: TEXT,
    manageUrl: TEXT,
    radiusKm: NUMBER,
    maxKm: NUMBER,
    postalCode: TEXT,
    sellerType: { type: 'string', enum: ALERT_SELLER_TYPES },
  },
  ['site', 'criteria', 'confirmedAt'],
);

const SUBMITTED_SETTINGS = knownFieldsOnly(
  {
    dealer: DEALER,
    zone: ZONE,
    maxKm: NUMBER,
    privateOnly: FLAG,
    specialOnly: FLAG,
    families: eachFamily(FAMILY_RULES),
    templates: eachFamily(MESSAGE_TEMPLATE),
    notifications: NOTIFICATIONS,
    imap: MAILBOX,
    httpSites: { type: 'array', items: HTTP_SITE },
    alertsDone: { type: 'object', additionalProperties: FLAG },
    alerts: { type: 'object', additionalProperties: ALERT },
  },
  [],
);

export const updateSettingsSchema: FastifySchema = { body: SUBMITTED_SETTINGS };

export const previewSettingsSchema: FastifySchema = { body: SUBMITTED_SETTINGS };
