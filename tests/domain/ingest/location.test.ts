import { describe, expect, it } from 'vitest';
import { locate, UNKNOWN_LOCATION, zoneCenter } from '../../../src/domain/ingest/location.js';
import { defaultSettings } from '../../../src/domain/settings/defaults.js';
import { PESSAC_POSITION } from '../../support/knownVehicle.js';

describe("position d'une voiture qui arrive, par rapport à la zone", () => {
  it('une 911 de Pessac est placée à un peu plus de 5 km du centre de Bordeaux', () => {
    // Given
    const center = zoneCenter(defaultSettings().zone);

    // When
    const location = center === undefined ? undefined : locate(center, PESSAC_POSITION);

    // Then
    expect(location).toEqual({ lat: 44.8067, lon: -0.6311, distanceKm: expect.closeTo(5.36, 2) });
  });

  it('une annonce dont la ville est introuvable : position et distance inconnues', () => {
    // Given
    const center = { lat: 44.8378, lon: -0.5792 };

    // When
    const location = locate(center, undefined);

    // Then
    expect(location).toEqual(UNKNOWN_LOCATION);
    expect(UNKNOWN_LOCATION).toEqual({ lat: null, lon: null, distanceKm: null });
  });

  it("une zone dont la ville n'a pas été reconnue n'a pas de centre : aucune distance n'est calculée", () => {
    // Given
    const zone = { ...defaultSettings().zone, city: 'Saint-Émilion', postalCode: '', lat: null, lon: null };

    // When
    const center = zoneCenter(zone);

    // Then
    expect(center).toBeUndefined();
  });
});
