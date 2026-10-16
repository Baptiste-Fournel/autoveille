import type { Family } from '../catalog/families.js';
import { defaultSettings } from './defaults.js';
import { perFamily } from './perFamily.js';
import type {
  AlertInfo,
  Dealer,
  FamilyRules,
  HttpSite,
  MailboxSettings,
  MessageTemplate,
  NotificationSettings,
  Settings,
  Zone,
} from './types.js';

export interface StoredSettings {
  readonly dealer?: Partial<Dealer>;
  readonly zone?: Partial<Zone>;
  readonly maxKm?: number;
  readonly privateOnly?: boolean;
  readonly specialOnly?: boolean;
  readonly alertsDone?: Readonly<Record<string, boolean>>;
  readonly alerts?: Readonly<Record<string, AlertInfo>>;
  readonly families?: Readonly<Partial<Record<Family, Partial<FamilyRules>>>>;
  readonly templates?: Readonly<Partial<Record<Family, Partial<MessageTemplate>>>>;
  readonly notifications?: Partial<NotificationSettings>;
  readonly imap?: Partial<MailboxSettings>;
  readonly httpSites?: readonly HttpSite[];
}

const V1_PLACEHOLDERS: readonly string[] = ['Prénom', 'Nom', 'Nom de la concession', '06 00 00 00 00'];

const isV1Placeholder = (value: unknown): boolean => V1_PLACEHOLDERS.some((placeholder) => placeholder === value);

const withoutV1Placeholders = (dealer: Dealer): Dealer => ({
  ...dealer,
  ...Object.fromEntries(
    Object.entries(dealer)
      .filter(([, value]) => isV1Placeholder(value))
      .map(([field]) => [field, '']),
  ),
});

const mergeFamilyRules = (defaults: FamilyRules, stored: Partial<FamilyRules> | undefined): FamilyRules =>
  stored
    ? { ...defaults, ...stored, known: [...new Set([...defaults.known, ...(stored.known ?? []), ...(stored.brands ?? [])])] }
    : defaults;

const mergeTemplate = (defaults: MessageTemplate, stored: Partial<MessageTemplate> | undefined): MessageTemplate =>
  stored && Array.isArray(stored.variants) ? { variants: stored.variants } : defaults;

export const mergeSettings = (stored: StoredSettings | undefined): Settings => {
  const defaults = defaultSettings();
  if (!stored) {
    return defaults;
  }
  return {
    dealer: withoutV1Placeholders({ ...defaults.dealer, ...stored.dealer }),
    zone: { ...defaults.zone, ...stored.zone },
    maxKm: stored.maxKm ?? defaults.maxKm,
    privateOnly: stored.privateOnly ?? defaults.privateOnly,
    specialOnly: stored.specialOnly ?? defaults.specialOnly,
    alertsDone: { ...stored.alertsDone },
    alerts: { ...stored.alerts },
    families: perFamily((family) => mergeFamilyRules(defaults.families[family], stored.families?.[family])),
    templates: perFamily((family) => mergeTemplate(defaults.templates[family], stored.templates?.[family])),
    notifications: { ...defaults.notifications, ...stored.notifications },
    imap: { ...defaults.imap, ...stored.imap },
    httpSites: stored.httpSites ?? defaults.httpSites,
  };
};
