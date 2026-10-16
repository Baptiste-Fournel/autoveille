import { defaultSettings } from '../../../domain/settings/defaults.js';
import { mergeSettings, type StoredSettings } from '../../../domain/settings/merge.js';
import type { Settings } from '../../../domain/settings/types.js';

export const settingsOf = (json: string | undefined): Settings => {
  if (json === undefined) {
    return defaultSettings();
  }
  try {
    const stored: StoredSettings = JSON.parse(json);
    return mergeSettings(stored);
  } catch {
    return defaultSettings();
  }
};

export const settingsJsonOf = (settings: Settings): string => JSON.stringify(settings);
