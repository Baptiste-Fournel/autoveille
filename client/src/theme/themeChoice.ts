import type { DevicePreferences } from '../storage/preferences';

export type ThemeChoice = 'auto' | 'light' | 'dark';

export const THEME_COLOR = { dark: '#15171A', light: '#F5F4F0' } as const;

export const THEME_COLOR_SELECTOR = 'meta[name=theme-color]';

export const DARK_SYSTEM_QUERY = '(prefers-color-scheme: dark)';

const isThemeChoice = (value: string | null): value is ThemeChoice => value === 'auto' || value === 'light' || value === 'dark';

export const storedThemeChoice = (preferences: DevicePreferences): ThemeChoice => {
  const stored = preferences.get('theme');
  return isThemeChoice(stored) ? stored : 'auto';
};
