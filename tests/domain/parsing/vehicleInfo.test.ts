import { describe, expect, it } from 'vitest';
import { type ExtractionContext, extractVehicleInfo } from '../../../src/domain/parsing/vehicleInfo.js';
import { rawListing } from '../../support/rawListing.js';

const context: ExtractionContext = { customBrands: [], currentYear: 2026 };

describe("identité d'une voiture lue dans une annonce", () => {
  it('« Porsche 911 Carrera 4S 3.0 450ch PDK 2017 42 000 km 112 900 € » : une 911 Carrera 4S de 2017, sans la fiche technique', () => {
    // Given
    const listing = rawListing('Porsche 911 Carrera 4S 3.0 450ch PDK 2017 42 000 km 112 900 €');

    // When
    const info = extractVehicleInfo(listing, context);

    // Then
    expect(info).toMatchObject({ make: 'Porsche', model: '911 Carrera 4S', family: 'allemandes', year: 2017, km: 42000, price: 112900 });
  });

  it("« BMW M3 Compétition », sans année, kilométrage ni prix dans le titre : l'année, le kilométrage et le prix viennent du site", () => {
    // Given
    const listing = rawListing('BMW M3 Compétition', { year: 2021, km: 18000, price: 79000 });

    // When
    const info = extractVehicleInfo(listing, context);

    // Then
    expect(info).toMatchObject({ make: 'BMW', model: 'M3 Compétition', year: 2021, km: 18000, price: 79000 });
  });

  it("une annonce publiée en 2026 pour un millésime 2027 garde son année, l'année en cours venant du contexte", () => {
    // Given
    const listing = rawListing('Porsche 911 Carrera T millésime 2027');

    // When
    const in2026 = extractVehicleInfo(listing, { customBrands: [], currentYear: 2026 });
    const in2025 = extractVehicleInfo(listing, { customBrands: [], currentYear: 2025 });

    // Then
    expect(in2026.year).toBe(2027);
    expect(in2025.year).toBeUndefined();
  });
});
