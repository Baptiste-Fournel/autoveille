import { describe, expect, it } from 'vitest';
import { devicePreferences } from '../../client/src/storage/preferences';

const refusedStorage = (): Storage => {
  throw new DOMException('The operation is insecure.', 'SecurityError');
};

describe('préférences propres à l’appareil', () => {
  it('sans stockage local (navigation privée qui en refuse l’accès), les écrans lisent les préférences par défaut et l’enregistrement est ignoré sans erreur', () => {
    // Given
    const preferences = devicePreferences(refusedStorage);

    // When
    const theme = preferences.get('theme');
    const stored = preferences.set('setup_hidden', '1');

    // Then
    expect(theme).toBeNull();
    expect(stored).toBe(false);
  });

  it('les préférences enregistrées par l’ancienne version de l’application sur ce téléphone sont relues sous les mêmes clés', () => {
    // Given
    window.localStorage.setItem('av_theme', 'dark');
    window.localStorage.setItem('av_filters', '{"sort":"priceAsc","families":["italiennes"],"sites":[]}');
    window.localStorage.setItem('av_filters_open', '1');
    window.localStorage.setItem('av_setup_hidden', '1');
    const preferences = devicePreferences(() => window.localStorage);

    // When
    const read = [preferences.get('theme'), preferences.get('filters'), preferences.get('filters_open'), preferences.get('setup_hidden')];

    // Then
    expect(read).toEqual(['dark', '{"sort":"priceAsc","families":["italiennes"],"sites":[]}', '1', '1']);
  });
});
