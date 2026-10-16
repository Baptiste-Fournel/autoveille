import { describe, expect, it } from 'vitest';
import { recordAlertConfirmation } from '../../../src/domain/settings/alerts.js';
import { defaultSettings } from '../../../src/domain/settings/defaults.js';
import type { AlertInfo } from '../../../src/domain/settings/types.js';

const laCentraleConfirmation: AlertInfo = {
  site: 'lacentrale',
  confirmedAt: '2026-09-14T16:25:03.000Z',
  manageUrl: 'https://www.lacentrale.fr/compte/notification/recherche',
  criteria: '100 000 km max, 33000, particuliers',
  maxKm: 100000,
  postalCode: '33000',
  sellerType: 'particulier',
};

describe("confirmations d'alerte des sites", () => {
  it('une confirmation d’alerte reçue par email coche le site dans la mise en route et garde ce que le site a dit', () => {
    // Given
    const settings = defaultSettings();

    // When
    const recorded = recordAlertConfirmation(settings, laCentraleConfirmation);

    // Then
    expect(recorded.alertsDone).toEqual({ lacentrale: true });
    expect(recorded.alerts).toEqual({ lacentrale: laCentraleConfirmation });
  });

  it('une boîte relue ne remplace pas la confirmation La Centrale la plus récente par une plus ancienne', () => {
    // Given
    const settings = recordAlertConfirmation(defaultSettings(), {
      site: 'lacentrale',
      criteria: '200 km, 150 000 km',
      confirmedAt: '2026-10-14T20:00:00.000Z',
      radiusKm: 200,
      maxKm: 150000,
    });
    const olderEmail: AlertInfo = {
      site: 'lacentrale',
      criteria: '100 km, 100 000 km',
      confirmedAt: '2026-10-14T15:33:00.000Z',
      radiusKm: 100,
      maxKm: 100000,
    };
    const newerEmail: AlertInfo = {
      site: 'lacentrale',
      criteria: '250 km',
      confirmedAt: '2026-10-15T09:00:00.000Z',
      radiusKm: 250,
      maxKm: 150000,
    };

    // When
    const afterOlderEmail = recordAlertConfirmation(settings, olderEmail);
    const afterNewerEmail = recordAlertConfirmation(afterOlderEmail, newerEmail);

    // Then
    expect(afterOlderEmail.alerts.lacentrale?.radiusKm).toBe(200);
    expect(afterNewerEmail.alerts.lacentrale?.radiusKm).toBe(250);
  });

  it('un email de confirmation plus ancien que celui enregistré rend les réglages tels quels, sans rien à enregistrer', () => {
    // Given
    const settings = recordAlertConfirmation(defaultSettings(), laCentraleConfirmation);
    const olderEmail: AlertInfo = { ...laCentraleConfirmation, criteria: '50 000 km max, 33000', confirmedAt: '2026-09-01T08:00:00.000Z' };

    // When
    const afterRereading = recordAlertConfirmation(settings, olderEmail);

    // Then
    expect(afterRereading).toBe(settings);
  });
});
