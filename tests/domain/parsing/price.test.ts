import { describe, expect, it } from 'vitest';
import { parseKm } from '../../../src/domain/parsing/km.js';
import { parsePrice } from '../../../src/domain/parsing/price.js';

describe("prix lu dans le texte d'une annonce", () => {
  it("un prix écrit « 89 900 € », « 89900€ » ou « 89.900 EUR » dans un titre d'annonce", () => {
    // Given
    const texts = ['Prix 89 900 €', '89900€', '89.900 EUR', '12 500 € 42 000 km', 'rien ici', 'Ferrari F430 F1 119 000 €'];
    const ferrariMileage = 'Ferrari F430 F1 31 000 km';

    // When
    const [spaced, glued, withDot, beforeMileage, none, ferrari] = texts.map(parsePrice);
    const ferrariKm = parseKm(ferrariMileage);

    // Then
    expect(spaced).toBe(89900);
    expect(glued).toBe(89900);
    expect(withDot).toBe(89900);
    expect(beforeMileage).toBe(12500);
    expect(none).toBeUndefined();
    expect(ferrari).toBe(119000);
    expect(ferrariKm).toBe(31000);
  });

  it('un email AutoScout24 où le prix est collé au kilométrage : « € 2 000 100 000 km »', () => {
    // Given
    const texts = ['€ 35 500 24 800 km, 10/2020', '€ 2 000 100 000 km, 10/2015', '€ 1 200 000 100 000 km', '€35500', 'EUR 12 900'];

    // When
    const [separate, glued, millionGlued, euroFirst, eurFirst] = texts.map(parsePrice);

    // Then
    expect(separate).toBe(35500);
    expect(glued).toBe(2000);
    expect(millionGlued).toBe(1200000);
    expect(euroFirst).toBe(35500);
    expect(eurFirst).toBe(12900);
  });

  it('une annonce qui écrit « Prix : 89 900 » sans symbole euro', () => {
    // Given
    const text = 'Porsche 911 Carrera S 2015 Prix : 89 900';

    // When
    const price = parsePrice(text);

    // Then
    expect(price).toBe(89900);
  });
});
