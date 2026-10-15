import { describe, expect, it } from 'vitest';
import { previewSettings } from '../../../src/application/settings/previewSettings.js';
import { defaultSettings } from '../../../src/domain/settings/defaults.js';
import { InvalidSettings } from '../../../src/domain/settings/invalidSettings.js';
import { AUDI_A3, BMW_M3_E46, PORSCHE_911_4S, storeFirstSighting } from '../../contracts/vehicleSamples.js';
import { settingsWorld } from '../../support/settingsWorld.js';

const THIS_WEEK = '2026-10-13T07:15:00.000Z';

describe('aperçu des réglages avant enregistrement', () => {
  it('le compteur « 1 annonce sur 3 cette semaine » passe à 2 quand on élargit le kilométrage à 150 000 km, sans rien enregistrer', async () => {
    // Given
    const world = settingsWorld();
    storeFirstSighting(world.vehicles, PORSCHE_911_4S, THIS_WEEK);
    const bmw = storeFirstSighting(world.vehicles, BMW_M3_E46, THIS_WEEK);
    storeFirstSighting(world.vehicles, AUDI_A3, THIS_WEEK);

    // When
    const unchanged = await previewSettings(world, {});
    const widened = await previewSettings(world, { maxKm: 150_000 });

    // Then
    expect(unchanged).toEqual({ total: 3, pass: 1 });
    expect(widened).toEqual({ total: 3, pass: 2 });
    expect(world.settings.load()).toEqual(defaultSettings());
    expect(world.vehicles.vehicle(bmw.vehicleId)?.matched).toBe(false);
  });

  it('une zone déplacée à Libourne, rayon de 30 km, est géocodée pour l’aperçu sans être enregistrée', async () => {
    // Given
    const world = settingsWorld();
    storeFirstSighting(world.vehicles, PORSCHE_911_4S, THIS_WEEK);
    const zone = { city: 'Libourne', postalCode: '33500', lat: 44.8378, lon: -0.5792, radiusKm: 30 };

    // When
    const preview = await previewSettings(world, { zone });

    // Then
    expect(preview).toEqual({ total: 1, pass: 0 });
    expect(world.geocoder.queries()).toEqual([{ city: 'Libourne', postalCode: '33500' }]);
    expect(world.settings.load().zone).toEqual(defaultSettings().zone);
  });

  it('la ville de la zone effacée dans le formulaire : l’aperçu est refusé comme l’enregistrement', async () => {
    // Given
    const world = settingsWorld();
    const zone = { ...defaultSettings().zone, city: '', postalCode: '' };

    // When
    const preview = previewSettings(world, { zone });

    // Then
    await expect(preview).rejects.toEqual(new InvalidSettings('missingZoneCity'));
  });
});
