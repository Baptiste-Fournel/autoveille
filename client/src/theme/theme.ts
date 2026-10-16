import { computed, type ReadonlySignal, signal } from '@preact/signals';
import type { DevicePreferences } from '../storage/preferences';
import { DARK_SYSTEM_QUERY, storedThemeChoice, THEME_COLOR, THEME_COLOR_SELECTOR, type ThemeChoice } from './themeChoice';

export interface Theme {
  readonly choice: ReadonlySignal<ThemeChoice>;
  readonly isDark: ReadonlySignal<boolean>;
  readonly apply: (choice: ThemeChoice) => void;
  readonly toggle: () => void;
  readonly stop: () => void;
}

export interface SystemThemeChange {
  readonly matches: boolean;
}

export interface SystemThemeQuery {
  readonly matches: boolean;
  readonly addEventListener: (type: 'change', listener: (change: SystemThemeChange) => void) => void;
  readonly removeEventListener: (type: 'change', listener: (change: SystemThemeChange) => void) => void;
}

export interface ThemeEnvironment {
  readonly document: Document;
  readonly matchMedia: ((query: string) => SystemThemeQuery) | undefined;
  readonly preferences: DevicePreferences;
}

export const createTheme = ({ document, matchMedia, preferences }: ThemeEnvironment): Theme => {
  const systemQuery = matchMedia?.(DARK_SYSTEM_QUERY);
  const choice = signal(storedThemeChoice(preferences));
  const systemDark = signal(systemQuery?.matches === true);
  const isDark = computed(() => choice.value === 'dark' || (choice.value === 'auto' && systemDark.value));

  const apply = (next: ThemeChoice): void => {
    if (next === 'auto') {
      document.documentElement.removeAttribute('data-theme');
    } else {
      document.documentElement.setAttribute('data-theme', next);
    }
    preferences.set('theme', next);
    choice.value = next;
    document.querySelector(THEME_COLOR_SELECTOR)?.setAttribute('content', isDark.value ? THEME_COLOR.dark : THEME_COLOR.light);
  };

  const followSystem = (change: SystemThemeChange): void => {
    systemDark.value = change.matches;
    if (choice.value === 'auto') {
      apply('auto');
    }
  };
  systemQuery?.addEventListener('change', followSystem);

  return {
    choice,
    isDark,
    apply,
    toggle: () => apply(isDark.value ? 'light' : 'dark'),
    stop: () => systemQuery?.removeEventListener('change', followSystem),
  };
};
