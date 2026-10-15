import { describe, expect, it } from 'vitest';
import { vehicleMessage } from '../../../src/domain/messaging/vehicleMessage.js';
import { defaultSettings } from '../../../src/domain/settings/defaults.js';
import { garageDuLac } from '../../support/dealer.js';

const settings = { ...defaultSettings(), dealer: garageDuLac };

const c63SCoupe = {
  fingerprint: '1e82adf805cbbb0e',
  make: 'Mercedes-Benz',
  model: 'C63 S Coupé',
  family: 'allemandes',
  year: 2019,
  km: 45200,
  price: 64900,
  distanceKm: 27.802371392887235,
  messageOverride: null,
} as const;

const firstListingOnLaCentrale = { title: 'Mercedes-AMG C63 S Coupé', siteLabel: 'La Centrale', city: 'Libourne' };

describe("le message proposé pour contacter le vendeur d'une voiture", () => {
  it('un message retouché à la main pour la C63 S Coupé est proposé tel quel, à la place du gabarit', () => {
    // Given
    const retouched = {
      ...c63SCoupe,
      messageOverride:
        'Bonjour,\n\nUn client cherche précisément ce coupé, je peux vous faire une proposition de reprise ferme sous 48 heures.\n\nVous pouvez me joindre au 06 12 34 56 78. Si vous préférez vendre par vous-même, aucun problème, je n’insisterai pas.\n\nJean Dupont\nGarage du Lac',
    };

    // When
    const message = vehicleMessage(retouched, firstListingOnLaCentrale, settings);

    // Then
    expect(message).toBe(retouched.messageOverride);
  });

  it('sans retouche, le message nomme la voiture d’après le véhicule et le site d’après sa première annonce', () => {
    // Given
    const vehicle = c63SCoupe;

    // When
    const message = vehicleMessage(vehicle, firstListingOnLaCentrale, settings);

    // Then
    expect(message).toContain('Mercedes-Benz C63 S Coupé 2019 sur La Centrale');
    expect(message).toContain('Garage du Lac');
    expect(message).not.toContain('Mercedes-AMG');
  });

  it('une C63 S Coupé restée sans annonce après une écriture interrompue n’a pas de message à proposer', () => {
    // Given
    const vehicleWithoutListing = c63SCoupe;

    // When
    const message = vehicleMessage(vehicleWithoutListing, undefined, settings);

    // Then
    expect(message).toBe('');
  });
});
