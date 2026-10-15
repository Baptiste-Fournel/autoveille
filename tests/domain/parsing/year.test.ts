import { describe, expect, it } from 'vitest';
import { maxPlausibleYear, parseYear } from '../../../src/domain/parsing/year.js';

const maxYear = maxPlausibleYear(2026);

describe("année lue dans le texte d'une annonce", () => {
  it("une année étiquetée « Année : 2009 » l'emporte, et « 2000 € » n'est pas une année", () => {
    // Given
    const texts = ['Porsche 911 2015 42 000 km', 'Année : 2009, 1ère main', 'Mercedes 190 Evo 2 1990', 'prix 2000 €'];

    // When
    const [isolated, labelled, afterModelNumbers, price] = texts.map((text) => parseYear(text, maxYear));

    // Then
    expect(isolated).toBe(2015);
    expect(labelled).toBe(2009);
    expect(afterModelNumbers).toBe(1990);
    expect(price).toBeUndefined();
  });

  it('« BMW 2002 tii 1973 » est lu 2002, ambiguïté connue où la première année isolée gagne', () => {
    // Given
    const text = 'BMW 2002 tii 1973';

    // When
    const year = parseYear(text, maxYear);

    // Then
    expect(year).toBe(2002);
  });

  it('une annonce « 1ère main 2015 » donne 2015', () => {
    // Given
    const text = 'Porsche 911 Carrera 1ère main 2015, carnet complet';

    // When
    const year = parseYear(text, maxYear);

    // Then
    expect(year).toBe(2015);
  });

  it('une annonce « 2015 - 42 000 km » donne 2015', () => {
    // Given
    const text = 'Porsche 911 Carrera 2015 - 42 000 km';

    // When
    const year = parseYear(text, maxYear);

    // Then
    expect(year).toBe(2015);
  });

  it('« 2019 km » est un kilométrage : une GT3 RS de 2022 qui a roulé 2 019 km', () => {
    // Given
    const text = 'Porsche 911 GT3 RS 2019 km, 2022';

    // When
    const year = parseYear(text, maxYear);

    // Then
    expect(year).toBe(2022);
  });

  it("une annonce publiée en 2026 accepte un millésime 2027, pas 2028 : l'année maximale est celle qui suit l'année en cours", () => {
    // Given
    const nextModelYear = 'Porsche 911 Carrera T millésime 2027';
    const tooFar = 'Porsche 911 Carrera T millésime 2028';

    // When
    const accepted = parseYear(nextModelYear, maxPlausibleYear(2026));
    const refused = parseYear(tooFar, maxPlausibleYear(2026));

    // Then
    expect(accepted).toBe(2027);
    expect(refused).toBeUndefined();
  });
});
