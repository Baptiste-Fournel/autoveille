import { describe, expect, it } from 'vitest';
import { type ExtractionContext, extractVehicleInfo } from '../../../src/domain/parsing/vehicleInfo.js';
import { fingerprint, similar } from '../../../src/domain/vehicle/identity.js';
import { rawListing } from '../../support/rawListing.js';

const context: ExtractionContext = { customBrands: [], currentYear: 2026 };

describe("identité d'une voiture à travers les sites et les republications", () => {
  it('la même 911 Carrera S sur Leboncoin et sur La Centrale a la même empreinte', () => {
    // Given
    const leboncoin = rawListing('Porsche 911 Carrera S 2015 42 000 km 89 900 €', { postalCode: '33700', site: 'leboncoin' });
    const laCentrale = rawListing('PORSCHE 911 CARRERA S PDK 2015', {
      km: 43500,
      price: 88000,
      postalCode: '33000',
      site: 'lacentrale',
      externalId: '9',
    });

    // When
    const onLeboncoin = fingerprint(extractVehicleInfo(leboncoin, context), leboncoin);
    const onLaCentrale = fingerprint(extractVehicleInfo(laCentrale, context), laCentrale);

    // Then
    expect(onLeboncoin).toBe(onLaCentrale);
  });

  it("deux 911 Carrera S d'années différentes, ou à 42 000 et 95 000 km, sont deux voitures ; kilométrage inconnu d'un côté, le prix décide", () => {
    // Given
    const of2015 = rawListing('Porsche 911 Carrera S 2015 42 000 km', { postalCode: '33700' });
    const of2016 = rawListing('Porsche 911 Carrera S 2016 42 000 km', { postalCode: '33700' });

    // When
    const fingerprintOf2015 = fingerprint(extractVehicleInfo(of2015, context), of2015);
    const fingerprintOf2016 = fingerprint(extractVehicleInfo(of2016, context), of2016);
    const closeMileages = similar({ km: 42000 }, { km: 43500 });
    const farMileages = similar({ km: 42000 }, { km: 95000 });
    const closeHighMileages = similar({ km: 150000 }, { km: 162000 });
    const unknownMileageClosePrices = similar({ km: undefined, price: 89000 }, { km: 42000, price: 86000 });
    const farPrices = similar({ price: 89000 }, { price: 60000 });

    // Then
    expect(fingerprintOf2015).not.toBe(fingerprintOf2016);
    expect(closeMileages).toBe(true);
    expect(farMileages).toBe(false);
    expect(closeHighMileages).toBe(true);
    expect(unknownMileageClosePrices).toBe(true);
    expect(farPrices).toBe(false);
  });

  it("deux voitures du même modèle aux kilométrages proches mais aux prix trop éloignés restent séparées, alors qu'une baisse de 14,6 % reste une republication", () => {
    // Given
    const mustang = { km: 45000, price: 54000 };

    // When
    const priceDownBy14Percent = similar(mustang, { km: 46000, price: 61900 });
    const pricesTooFar = similar(mustang, { km: 46000, price: 70000 });
    const absurdValues = similar({ km: 1, price: 2800 }, { km: 999, price: 200 });

    // Then
    expect(priceDownBy14Percent).toBe(true);
    expect(pricesTooFar).toBe(false);
    expect(absurdValues).toBe(false);
  });

  it("une annonce d'email sans kilométrage face à la même 911 sur le site : le prix seul décide, à 10 % près", () => {
    // Given
    const emailWithoutKm = { price: 89900 };
    const sameCarOnSite = { km: 42000, price: 82000 };
    const otherCarOnSite = { km: 42000, price: 79000 };

    // When
    const sameCar = similar(emailWithoutKm, sameCarOnSite);
    const otherCar = similar(emailWithoutKm, otherCarOnSite);

    // Then
    expect(sameCar).toBe(true);
    expect(otherCar).toBe(false);
  });

  it('deux 911 Carrera S de 2015 en Gironde au même prix, à 42 000 et 95 000 km : même empreinte, mais deux voitures', () => {
    // Given
    const lowMileage = rawListing('Porsche 911 Carrera S 2015 42 000 km 89 900 €', { postalCode: '33700' });
    const highMileage = rawListing('Porsche 911 Carrera S 2015 95 000 km 89 900 €', { postalCode: '33000', externalId: '2' });
    const lowInfo = extractVehicleInfo(lowMileage, context);
    const highInfo = extractVehicleInfo(highMileage, context);

    // When
    const sameFingerprint = fingerprint(lowInfo, lowMileage) === fingerprint(highInfo, highMileage);
    const sameCar = similar(lowInfo, highInfo);

    // Then
    expect(sameFingerprint).toBe(true);
    expect(sameCar).toBe(false);
  });
});
