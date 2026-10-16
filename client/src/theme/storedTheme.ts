import type { DevicePreferences } from '../storage/preferences';
import { THEME_COLOR, THEME_COLOR_SELECTOR } from './themeChoice';

export const applyStoredTheme = (document: Document, preferences: DevicePreferences): void => {
  const chosen = preferences.get('theme');
  if (chosen === 'dark' || chosen === 'light') {
    document.documentElement.setAttribute('data-theme', chosen);
    document.querySelector(THEME_COLOR_SELECTOR)?.setAttribute('content', THEME_COLOR[chosen]);
  }
};
