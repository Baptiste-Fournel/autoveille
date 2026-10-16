import { describe, expect, it } from 'vitest';
import { getSettings } from '../../../src/application/settings/getSettings.js';
import { defaultSettings } from '../../../src/domain/settings/defaults.js';
import { fakeSettingsRepository } from '../../fakes/fakeSettingsRepository.js';
import { settingsWithDealerMailbox } from '../../support/dealerMailbox.js';

describe('ouvrir les réglages', () => {
  it('avant tout enregistrement, les réglages sont ceux livrés par défaut : Bordeaux, 100 km, 100 000 km', () => {
    // Given
    const settings = fakeSettingsRepository();

    // When
    const opened = getSettings({ settings });

    // Then
    expect(opened).toEqual(defaultSettings());
    expect(opened.zone).toMatchObject({ city: 'Bordeaux', radiusKm: 100 });
    expect(opened.maxKm).toBe(100_000);
  });

  it('après l’enregistrement de la boîte mail, les réglages relus la contiennent, mot de passe d’application compris', () => {
    // Given
    const saved = settingsWithDealerMailbox();
    const settings = fakeSettingsRepository(saved);

    // When
    const opened = getSettings({ settings });

    // Then
    expect(opened).toEqual(saved);
  });
});
