import { expect, it } from 'vitest';
import type { SettingsRepository } from '../../src/application/ports/settingsRepository.js';
import { defaultSettings } from '../../src/domain/settings/defaults.js';
import type { Settings } from '../../src/domain/settings/types.js';
import { garageDuLac } from '../support/dealer.js';

const afterSetup = (): Settings => {
  const defaults = defaultSettings();
  return {
    ...defaults,
    dealer: garageDuLac,
    zone: { city: 'Mérignac', postalCode: '33700', lat: 44.8386, lon: -0.6436, radiusKm: 150 },
    imap: { ...defaults.imap, user: 'alertes.garagedulac@example.com', pass: 'abcd efgh ijkl mnop' },
    httpSites: [{ id: 'k3v9q2xa', name: 'Leparking', url: 'https://www.leparking.fr/voiture-occasion/porsche-911.html', enabled: true }],
    alertsDone: { leboncoin: true },
    alerts: {
      lacentrale: {
        site: 'lacentrale',
        criteria: '80 000 km max, 33000, particuliers',
        confirmedAt: '2026-10-12T17:42:05.000Z',
        manageUrl: 'https://www.lacentrale.fr/compte/notification/recherche',
        maxKm: 80000,
        postalCode: '33000',
        sellerType: 'particulier',
      },
    },
  };
};

export function settingsRepositoryContract(create: () => SettingsRepository): void {
  it('avant la mise en route, les réglages sont ceux livrés par défaut : Bordeaux, 100 km, 100 000 km', () => {
    // Given
    const repository = create();

    // When
    const settings = repository.load();

    // Then
    expect(settings).toEqual(defaultSettings());
  });

  it('les réglages enregistrés à la mise en route du Garage du Lac se relisent tels quels', () => {
    // Given
    const repository = create();
    const settings = afterSetup();

    // When
    repository.save(settings);

    // Then
    expect(repository.load()).toEqual(settings);
  });

  it('le rayon élargi à 200 km et enregistré remplace l’ancien réglage', () => {
    // Given
    const repository = create();
    const settings = afterSetup();
    repository.save(settings);

    // When
    repository.save({ ...settings, zone: { ...settings.zone, radiusKm: 200 } });

    // Then
    expect(repository.load()).toEqual({ ...settings, zone: { ...settings.zone, radiusKm: 200 } });
  });
}
