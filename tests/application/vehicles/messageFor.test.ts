import { describe, expect, it } from 'vitest';
import { messageFor } from '../../../src/application/vehicles/messageFor.js';
import { defaultSettings } from '../../../src/domain/settings/defaults.js';
import { newListing } from '../../../src/domain/vehicle/changes.js';
import { MERCEDES_C63, storeFirstSighting } from '../../contracts/vehicleSamples.js';
import { fakePersistence } from '../../fakes/fakePersistence.js';
import { garageDuLac } from '../../support/dealer.js';

const KEPT = { matched: true, rejections: [] } as const;

const settings = { ...defaultSettings(), dealer: garageDuLac };

const MERCEDES_C63_ON_LEBONCOIN = {
  ...MERCEDES_C63,
  site: 'leboncoin',
  siteLabel: 'Leboncoin',
  externalId: '2811012345',
  url: 'https://www.leboncoin.fr/ad/voitures/2811012345',
  title: 'Mercedes-AMG C63 S Coupé 510ch',
};

const RETOUCHED =
  'Bonjour,\n\nUn client cherche précisément ce coupé, je peux vous faire une proposition de reprise ferme sous 48 heures.\n\nVous pouvez me joindre au 06 12 34 56 78. Si vous préférez vendre par vous-même, aucun problème, je n’insisterai pas.\n\nJean Dupont\nGarage du Lac';

describe('le message proposé pour contacter le vendeur', () => {
  it('un message retouché à la main pour la C63 S Coupé est proposé tel quel, à la place du gabarit', () => {
    // Given
    const { vehicles } = fakePersistence();
    const mercedes = storeFirstSighting(vehicles, MERCEDES_C63, '2026-10-10T09:00:00.000Z', { ...KEPT, messageOverride: RETOUCHED });
    const vehicle = vehicles.vehicle(mercedes.vehicleId);

    // When
    const message = vehicle === undefined ? undefined : messageFor({ vehicles }, vehicle, settings);

    // Then
    expect(message).toBe(RETOUCHED);
  });

  it('la C63 S vue d’abord sur La Centrale puis sur Leboncoin : le message parle de l’annonce La Centrale, la première lue', () => {
    // Given
    const { vehicles } = fakePersistence();
    const mercedes = storeFirstSighting(vehicles, MERCEDES_C63, '2026-10-10T09:00:00.000Z', KEPT);
    vehicles.addListing(mercedes.vehicleId, newListing(MERCEDES_C63_ON_LEBONCOIN, '2026-10-13T08:00:00.000Z'));
    const vehicle = vehicles.vehicle(mercedes.vehicleId);

    // When
    const message = vehicle === undefined ? undefined : messageFor({ vehicles }, vehicle, settings);

    // Then
    expect(message).toContain('Mercedes-Benz C63 S Coupé 2019 sur La Centrale');
    expect(message).not.toContain('Leboncoin');
    expect(message).toContain('Garage du Lac');
  });
});
