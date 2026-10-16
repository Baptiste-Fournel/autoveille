import { describe, expect, it } from 'vitest';
import { settingsProblemText } from '../../../src/domain/presentation/settings.js';
import { recordAlertConfirmation } from '../../../src/domain/settings/alerts.js';
import { defaultSettings } from '../../../src/domain/settings/defaults.js';
import { InvalidSettings } from '../../../src/domain/settings/invalidSettings.js';
import { sanitizeSettings } from '../../../src/domain/settings/sanitize.js';
import type { AlertInfo, Settings } from '../../../src/domain/settings/types.js';

const unusedId = (): string => {
  throw new Error('aucun identifiant ne devait être tiré');
};

const laCentraleConfirmation: AlertInfo = {
  site: 'lacentrale',
  confirmedAt: '2026-09-14T16:25:03.000Z',
  manageUrl: 'https://www.lacentrale.fr/compte/notification/recherche',
  criteria: '100 000 km max, 33000, particuliers',
  maxKm: 100000,
  postalCode: '33000',
  sellerType: 'particulier',
};

const sanitized = (next: Settings, current: Settings, newId: () => string = unusedId): Settings => {
  const result = sanitizeSettings(next, current, newId);
  if (result instanceof InvalidSettings) {
    throw result;
  }
  return result;
};

describe('réglages enregistrés depuis le formulaire', () => {
  it('des réglages ouverts avant l’arrivée de la confirmation La Centrale ne l’effacent pas en étant enregistrés', () => {
    // Given
    const openedBefore = defaultSettings();
    const current = recordAlertConfirmation(openedBefore, laCentraleConfirmation);
    const sent: Settings = { ...openedBefore, maxKm: 150_000 };

    // When
    const saved = sanitized(sent, current);

    // Then
    expect(saved.maxKm).toBe(150_000);
    expect(saved.alerts).toEqual({ lacentrale: laCentraleConfirmation });
    expect(saved.alertsDone).toEqual({ lacentrale: true });
  });

  it('comportement hérité : des réglages ouverts avant une nouvelle confirmation du même site la remplacent par l’ancienne en étant enregistrés', () => {
    // Given
    const openedBefore = recordAlertConfirmation(defaultSettings(), laCentraleConfirmation);
    const newerConfirmation: AlertInfo = {
      ...laCentraleConfirmation,
      confirmedAt: '2026-10-14T20:00:00.000Z',
      criteria: '150 000 km max, 33000, particuliers',
      maxKm: 150000,
    };
    const current = recordAlertConfirmation(openedBefore, newerConfirmation);

    // When
    const saved = sanitized(openedBefore, current);

    // Then
    expect(saved.alerts.lacentrale).toEqual(laCentraleConfirmation);
  });

  it('un site lu directement envoyé sans identifiant en reçoit un, les autres gardent le leur', () => {
    // Given
    const current = defaultSettings();
    const sent: Settings = {
      ...current,
      httpSites: [
        { id: 'k3v9x2ab', name: 'Leparking', url: 'https://www.leparking.fr/voiture-occasion/bmw-m3.html', enabled: true },
        { id: '', name: 'La Centrale', url: 'https://www.lacentrale.fr/listing?makesModelsCommercialNames=PORSCHE', enabled: true },
      ],
    };

    // When
    const saved = sanitized(sent, current, () => 'p7q2m4cd');

    // Then
    expect(saved.httpSites.map((site) => site.id)).toEqual(['k3v9x2ab', 'p7q2m4cd']);
  });

  it('un port IMAP effacé dans le formulaire, envoyé comme 0, redevient 993', () => {
    // Given
    const current = defaultSettings();
    const sent: Settings = { ...current, imap: { ...current.imap, port: 0 } };

    // When
    const saved = sanitized(sent, current);

    // Then
    expect(saved.imap.port).toBe(993);
  });

  it('une zone dont la ville et le code postal ont été effacés est refusée : « Indiquez la ville de la zone. »', () => {
    // Given
    const current = defaultSettings();
    const sent: Settings = { ...current, zone: { ...current.zone, city: '  ', postalCode: '' } };

    // When
    const result = sanitizeSettings(sent, current, unusedId);

    // Then
    expect(result).toBeInstanceOf(InvalidSettings);
    expect(result instanceof InvalidSettings && settingsProblemText(result.problem)).toBe('Indiquez la ville de la zone.');
  });
});
