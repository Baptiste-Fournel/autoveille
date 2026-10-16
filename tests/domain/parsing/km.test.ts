import { describe, expect, it } from 'vitest';
import { parseKm } from '../../../src/domain/parsing/km.js';

describe("kilométrage lu dans le texte d'une annonce", () => {
  it('« à 12 km de chez vous, 65 500 kms » : 12 km est une distance, le kilométrage est 65 500', () => {
    // Given
    const spaced = '42 000 km';
    const glued = '42000km';
    const distanceBeforeMileage = 'à 12 km de chez vous, 65 500 kms';

    // When
    const [spacedKm, gluedKm, mileage] = [spaced, glued, distanceBeforeMileage].map(parseKm);

    // Then
    expect(spacedKm).toBe(42000);
    expect(gluedKm).toBe(42000);
    expect(mileage).toBe(65500);
  });

  it('un kilométrage écrit avec un point et en majuscules, « 42.000 KM »', () => {
    // Given
    const text = 'Porsche 911 Carrera 4S 2017 42.000 KM';

    // When
    const km = parseKm(text);

    // Then
    expect(km).toBe(42000);
  });

  it('un email AutoScout24 où le prix est collé au kilométrage, « € 2 000 100 000 km » donne 100 000 km', () => {
    // Given
    const text = '€ 2 000 100 000 km, 10/2015';

    // When
    const km = parseKm(text);

    // Then
    expect(km).toBe(100000);
  });
});
