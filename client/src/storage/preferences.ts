export type PreferenceKey = 'theme' | 'filters' | 'filters_open' | 'setup_hidden';

export interface DevicePreferences {
  readonly get: (key: PreferenceKey) => string | null;
  readonly set: (key: PreferenceKey, value: string) => boolean;
}

const STORAGE_PREFIX = 'av_';

const attempt = <T>(access: () => T, fallback: T): T => {
  try {
    return access();
  } catch {
    return fallback;
  }
};

export const devicePreferences = (storage: () => Storage): DevicePreferences => ({
  get: (key) => attempt(() => storage().getItem(`${STORAGE_PREFIX}${key}`), null),
  set: (key, value) =>
    attempt(() => {
      storage().setItem(`${STORAGE_PREFIX}${key}`, value);
      return true;
    }, false),
});
