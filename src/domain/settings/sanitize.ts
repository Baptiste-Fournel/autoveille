import { UNNAMED_HTTP_SITE } from '../presentation/settings.js';
import { isWebAddress } from '../sites/webAddress.js';
import { DEFAULT_IMAP_PORT } from './defaults.js';
import { InvalidSettings } from './invalidSettings.js';
import { perFamily } from './perFamily.js';
import type { AlertInfo, FamilyRules, HttpSite, MessageTemplate, Settings, Zone } from './types.js';

type Alerts = Settings['alerts'];

const SITE_KEY_MAX_LENGTH = 40;
const ALERT_CRITERIA_MAX_LENGTH = 300;
const ALERT_MANAGE_URL_MAX_LENGTH = 500;

const wholeNonNegative = (value: unknown): number => Math.max(0, Math.round(Number(value) || 0));

const trimmedText = (value: unknown): string => String(value ?? '').trim();

const trimmedEntries = (values: readonly unknown[] | undefined): readonly string[] =>
  (values ?? []).map((value) => String(value).trim()).filter(Boolean);

const sanitizeZone = (zone: Zone): Zone => ({
  ...zone,
  radiusKm: wholeNonNegative(zone.radiusKm),
  city: trimmedText(zone.city),
  postalCode: trimmedText(zone.postalCode),
});

const sanitizeFamilyRules = (rules: FamilyRules): FamilyRules => {
  const brands = trimmedEntries(rules.brands);
  return {
    ...rules,
    minPrice: wholeNonNegative(rules.minPrice),
    maxYear: wholeNonNegative(rules.maxYear),
    keywords: trimmedEntries(rules.keywords),
    brands,
    known: [...new Set(trimmedEntries([...(rules.known ?? []), ...brands]))],
  };
};

const sanitizeTemplate = (template: MessageTemplate): MessageTemplate => ({
  ...template,
  variants: (template.variants ?? []).map((variant) => String(variant).replace(/\r\n/g, '\n').trim()).filter(Boolean),
});

const sanitizeHttpSite = (site: HttpSite, newHttpSiteId: () => string): HttpSite => ({
  id: site.id || newHttpSiteId(),
  name: trimmedText(site.name) || UNNAMED_HTTP_SITE,
  url: trimmedText(site.url),
  enabled: site.enabled !== false,
});

const keepRecordedAlerts = (sent: Alerts | undefined, recorded: Alerts): Alerts => ({ ...recorded, ...sent });

const isAlertConfirmation = (alert: AlertInfo): boolean =>
  Boolean(alert) && typeof alert === 'object' && typeof alert.criteria === 'string';

const webPageOrUndefined = (url: string | undefined): string | undefined =>
  url && isWebAddress(url) ? url.slice(0, ALERT_MANAGE_URL_MAX_LENGTH) : undefined;

const siteKey = (site: string): string => String(site).slice(0, SITE_KEY_MAX_LENGTH);

const sanitizeAlerts = (alerts: Alerts): Alerts =>
  Object.fromEntries(
    Object.entries(alerts)
      .filter(([, alert]) => isAlertConfirmation(alert))
      .map(([site, alert]) => [
        siteKey(site),
        {
          ...alert,
          site: siteKey(site),
          criteria: String(alert.criteria).slice(0, ALERT_CRITERIA_MAX_LENGTH),
          manageUrl: webPageOrUndefined(alert.manageUrl),
        },
      ]),
  );

const sanitizeAlertsDone = (done: Settings['alertsDone'] | undefined, alerts: Alerts): Settings['alertsDone'] => ({
  ...Object.fromEntries(
    Object.entries(done ?? {})
      .filter(([, isDone]) => isDone === true)
      .map(([site]) => [siteKey(site), true]),
  ),
  ...Object.fromEntries(Object.keys(alerts).map((site) => [site, true])),
});

export const sanitizeSettings = (next: Settings, current: Settings, newHttpSiteId: () => string): Settings | InvalidSettings => {
  const zone = sanitizeZone(next.zone);
  if (!zone.city && !zone.postalCode) {
    return new InvalidSettings('missingZoneCity');
  }
  const alerts = sanitizeAlerts(keepRecordedAlerts(next.alerts, current.alerts));
  return {
    ...next,
    maxKm: wholeNonNegative(next.maxKm),
    zone,
    families: perFamily((family) => sanitizeFamilyRules(next.families[family])),
    templates: perFamily((family) => sanitizeTemplate(next.templates[family])),
    httpSites: (next.httpSites ?? []).map((site) => sanitizeHttpSite(site, newHttpSiteId)),
    imap: { ...next.imap, port: Number(next.imap.port) || DEFAULT_IMAP_PORT },
    alerts,
    alertsDone: sanitizeAlertsDone(next.alertsDone, alerts),
  };
};
