import { describe, expect, it } from 'vitest';
import { type CustomBrand, detectBrand, detectFamily } from '../../../src/domain/catalog/brands.js';
import { type ExtractionContext, extractVehicleInfo } from '../../../src/domain/parsing/vehicleInfo.js';
import { rawListing } from '../../support/rawListing.js';

const context: ExtractionContext = { customBrands: [], currentYear: 2026 };
const NO_BRAND_ADDED: readonly CustomBrand[] = [];

describe("marque et famille d'une voiture", () => {
  it("la marque reconnue sous ses graphies d'annonces, la plus longue d'abord : « Alfa Romeo » avant « Alfa », « Dodge RAM » avant « Dodge »", () => {
    // Given
    const brandOf = (title: string) => detectBrand(title, NO_BRAND_ADDED);

    // When
    const amg = brandOf('Mercedes AMG GT 63 S');
    const alfaRomeo = brandOf('Alfa Romeo 4C');
    const dodgeRam = brandOf('Dodge RAM 1500');
    const vw = brandOf('VW Golf GTI');
    const citroen = brandOf('Citroen DS 21');
    const renault = brandOf('Renault Clio');
    const toyota = brandOf('Toyota Supra');
    const zastava = brandOf('Zastava Yugo');

    // Then
    expect(amg?.make).toBe('Mercedes-Benz');
    expect(alfaRomeo?.make).toBe('Alfa Romeo');
    expect(dodgeRam?.make).toBe('RAM');
    expect(vw?.make).toBe('Volkswagen');
    expect(citroen?.make).toBe('Citroën');
    expect(renault).toBeTruthy();
    expect(toyota).toMatchObject({ make: 'Toyota', family: 'autres' });
    expect(zastava).toBeUndefined();
  });

  it('une Ford Mustang est américaine, une Ford Fiesta va dans les autres marques', () => {
    // Given
    const mustang = { model: 'Mustang GT', title: 'Ford Mustang GT 5.0' };
    const fiesta = { model: 'Fiesta', title: 'Ford Fiesta 1.0' };

    // When
    const mustangFamily = detectFamily('Ford', mustang.model, mustang.title, NO_BRAND_ADDED);
    const fiestaFamily = detectFamily('Ford', fiesta.model, fiesta.title, NO_BRAND_ADDED);

    // Then
    expect(mustangFamily).toBe('americaines');
    expect(fiestaFamily).toBe('autres');
  });

  it("une Mazda est nommée et rangée dans les autres marques ; une Toyota déplacée par l'utilisateur chez les allemandes y va", () => {
    // Given
    const mazda = rawListing('Mazda 5 2.0 CD-MZR 143 7pl Elegance');
    const toyota = rawListing('Toyota Supra 3.0');
    const toyotaMovedToGerman: ExtractionContext = { customBrands: [{ name: 'Toyota', family: 'allemandes' }], currentYear: 2026 };

    // When
    const mazdaInfo = extractVehicleInfo(mazda, context);
    const moved = extractVehicleInfo(toyota, toyotaMovedToGerman);

    // Then
    expect(mazdaInfo).toMatchObject({ make: 'Mazda', model: '5', family: 'autres' });
    expect(moved).toMatchObject({ make: 'Toyota', family: 'allemandes' });
  });

  it('une « Mercedes-AMG C63 » est une Mercedes-Benz', () => {
    // Given
    const listing = rawListing('Mercedes-AMG C63 S 4.0 V8 510ch');

    // When
    const info = extractVehicleInfo(listing, context);

    // Then
    expect(info).toMatchObject({ make: 'Mercedes-Benz', family: 'allemandes' });
  });
});
