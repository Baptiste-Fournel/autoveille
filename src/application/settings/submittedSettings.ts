import { InvalidSettings } from '../../domain/settings/invalidSettings.js';
import { mergeSettings } from '../../domain/settings/merge.js';
import { sanitizeSettings } from '../../domain/settings/sanitize.js';
import type { Settings, Zone } from '../../domain/settings/types.js';
import type { ZoneWarning } from '../../domain/settings/zoneWarning.js';
import type { Geocoder } from '../ports/geocoder.js';
import type { Random } from '../ports/random.js';
import type { SettingsRepository } from '../ports/settingsRepository.js';

export type SubmittedSettings = Partial<Settings>;

export interface LocatedSettings {
  readonly settings: Settings;
  readonly warning?: ZoneWarning;
}

export interface SubmittedSettingsDependencies {
  readonly settings: SettingsRepository;
  readonly geocoder: Geocoder;
  readonly random: Random;
}

const zoneNeedsLocating = (next: Zone, current: Zone): boolean =>
  next.city !== current.city || next.postalCode !== current.postalCode || next.lat === null;

const withCoordinates = (settings: Settings, lat: number | null, lon: number | null): Settings => ({
  ...settings,
  zone: { ...settings.zone, lat, lon },
});

const locateZone = async (geocoder: Geocoder, next: Settings, current: Settings): Promise<LocatedSettings> => {
  if (!zoneNeedsLocating(next.zone, current.zone)) {
    return { settings: next };
  }
  const place = await geocoder.locate({ city: next.zone.city, postalCode: next.zone.postalCode || undefined });
  if (place === undefined) {
    return { settings: withCoordinates(next, null, null), warning: 'cityNotFound' };
  }
  const located = withCoordinates(next, place.lat, place.lon);
  return place.precision === 'department' ? { settings: located, warning: 'cityLocatedByDepartment' } : { settings: located };
};

export const readSubmittedSettings = async (
  { settings, geocoder, random }: SubmittedSettingsDependencies,
  submitted: SubmittedSettings,
): Promise<LocatedSettings> => {
  const current = settings.load();
  const next = sanitizeSettings(mergeSettings({ ...current, ...submitted }), current, () => random.shortId());
  if (next instanceof InvalidSettings) {
    throw next;
  }
  return locateZone(geocoder, next, current);
};
