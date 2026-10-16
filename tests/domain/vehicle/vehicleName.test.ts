import { describe, expect, it } from 'vitest';
import { extractVehicleInfo } from '../../../src/domain/parsing/vehicleInfo.js';
import { customBrandsOf } from '../../../src/domain/settings/customBrands.js';
import { defaultSettings } from '../../../src/domain/settings/defaults.js';
import { vehicleName } from '../../../src/domain/vehicle/vehicleName.js';
import { rawListing } from '../../support/rawListing.js';

const infoOf = (title: string) =>
  extractVehicleInfo(rawListing(title), { customBrands: customBrandsOf(defaultSettings()), currentYear: 2026 });

describe('nom affiché d’une voiture', () => {
  it('une 911 reconnue s’appelle par sa marque et son modèle, sans la fiche technique du titre', () => {
    // Given
    const title = 'Porsche 911 Carrera 4S 3.0 450ch PDK 2017 42 000 km 112 900 €';

    // When
    const name = vehicleName(infoOf(title), title);

    // Then
    expect(name).toBe('Porsche 911 Carrera 4S');
  });

  it('une Artega GT, marque absente du catalogue, garde le titre de son annonce', () => {
    // Given
    const title = 'Artega GT 2009 28 000 km 42 000 €';

    // When
    const name = vehicleName(infoOf(title), title);

    // Then
    expect(name).toBe(title);
  });
});
