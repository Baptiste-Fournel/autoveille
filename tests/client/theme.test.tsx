import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fireEvent, render, screen } from '@testing-library/preact';
import { describe, expect, it } from 'vitest';
import { AppContext } from '../../client/src/app/AppContext';
import { devicePreferences } from '../../client/src/storage/preferences';
import { applyStoredTheme } from '../../client/src/theme/storedTheme';
import { ThemeButton } from '../../client/src/theme/ThemeButton';
import { createTheme, type SystemThemeChange, type SystemThemeQuery } from '../../client/src/theme/theme';
import { fakeServer } from './support/fakeServer';
import { applicationState } from './support/testApplication';

const CLIENT_PAGE = resolve('client', 'index.html');

interface SystemTheme {
  readonly matchMedia: (query: string) => SystemThemeQuery;
  readonly switchTo: (dark: boolean) => void;
}

const systemTheme = (initiallyDark: boolean): SystemTheme => {
  const listeners: ((change: SystemThemeChange) => void)[] = [];
  const query: SystemThemeQuery = {
    matches: initiallyDark,
    addEventListener: (_type, listener) => {
      listeners.push(listener);
    },
    removeEventListener: () => undefined,
  };
  return {
    matchMedia: () => query,
    switchTo: (dark) => {
      for (const listener of listeners) {
        listener({ matches: dark });
      }
    },
  };
};

const themeColor = (): string | null => document.querySelector('meta[name=theme-color]')?.getAttribute('content') ?? null;

const withThemeColorMeta = (): void => {
  document.head.innerHTML = '<meta name="theme-color" content="#F5F4F0">';
};

describe('thème clair ou sombre', () => {
  it('le thème clair ou sombre choisi sur le téléphone est appliqué avant l’affichage par un script classique servi par l’application, en tête de page avant l’application, la page n’ayant aucun script en ligne', () => {
    // Given
    const page = new DOMParser().parseFromString(readFileSync(CLIENT_PAGE, 'utf8'), 'text/html');
    withThemeColorMeta();
    window.localStorage.setItem('av_theme', 'dark');

    // When
    applyStoredTheme(
      document,
      devicePreferences(() => window.localStorage),
    );

    // Then
    const scripts = [...page.querySelectorAll('script')];
    expect(scripts.map((script) => [script.getAttribute('type'), script.getAttribute('src'), script.textContent])).toEqual([
      [null, '/theme.js', ''],
      ['module', '/src/main.tsx', ''],
    ]);
    expect(page.head.contains(scripts[0] ?? null)).toBe(true);
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    expect(themeColor()).toBe('#15171A');
  });

  it('le thème choisi reste après un rechargement sur cet appareil, et « Comme l’appareil » suit ensuite le téléphone', () => {
    // Given
    withThemeColorMeta();
    const system = systemTheme(true);
    const preferences = devicePreferences(() => window.localStorage);
    createTheme({ document, matchMedia: system.matchMedia, preferences }).apply('light');

    // When
    const reloaded = createTheme({ document, matchMedia: system.matchMedia, preferences });
    const afterReload = { choice: reloaded.choice.value, dark: reloaded.isDark.value };
    reloaded.apply('auto');
    const followingPhone = reloaded.isDark.value;
    system.switchTo(false);

    // Then
    expect(afterReload).toEqual({ choice: 'light', dark: false });
    expect(followingPhone).toBe(true);
    expect(reloaded.isDark.value).toBe(false);
    expect(window.localStorage.getItem('av_theme')).toBe('auto');
    expect(document.documentElement.hasAttribute('data-theme')).toBe(false);
    expect(themeColor()).toBe('#F5F4F0');
  });

  it('le soleil ou la lune bascule à partir du thème affiché, même en mode « Comme l’appareil » sur un téléphone en sombre', () => {
    // Given
    withThemeColorMeta();
    const state = applicationState(fakeServer());
    const system = systemTheme(true);
    const theme = createTheme({ document, matchMedia: system.matchMedia, preferences: state.preferences });
    render(
      <AppContext.Provider value={{ ...state, theme }}>
        <ThemeButton />
      </AppContext.Provider>,
    );
    const toLight = screen.getByRole('button', { name: 'Passer en mode clair' });
    const pressedWhileDark = toLight.getAttribute('aria-pressed');

    // When
    fireEvent.click(toLight);

    // Then
    const toDark = screen.getByRole('button', { name: 'Passer en mode sombre' });
    expect(pressedWhileDark).toBe('true');
    expect(toDark.getAttribute('aria-pressed')).toBe('false');
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
    expect(window.localStorage.getItem('av_theme')).toBe('light');
    expect(themeColor()).toBe('#F5F4F0');
  });
});
