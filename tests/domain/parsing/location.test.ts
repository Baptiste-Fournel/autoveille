import { describe, expect, it } from 'vitest';
import { parseLocation } from '../../../src/domain/parsing/location.js';

describe("ville et code postal lus dans le texte d'une annonce", () => {
  it('une ville avant ou après son code postal, ou suivie de son département : « Mérignac 33700 », « 33700 Mérignac », « Bordeaux (33) »', () => {
    // Given
    const cityFirst = 'Mérignac 33700';
    const postalCodeFirst = '33700 Mérignac';
    const withDepartment = 'Bordeaux (33)';
    const hyphenatedWithDepartment = 'Saint-Médard-en-Jalles (33)';

    // When
    const [merignac, merignacAgain, bordeaux, saintMedard] = [cityFirst, postalCodeFirst, withDepartment, hyphenatedWithDepartment].map(
      parseLocation,
    );

    // Then
    expect(merignac).toEqual({ city: 'Mérignac', postalCode: '33700' });
    expect(merignacAgain).toEqual({ city: 'Mérignac', postalCode: '33700' });
    expect(bordeaux).toEqual({ city: 'Bordeaux', postalCode: '33000' });
    expect(saintMedard?.city).toBe('Saint-Médard-En-Jalles');
  });

  it('une ville séparée de son code postal par un tiret, « Pessac - 33600 »', () => {
    // Given
    const text = 'Pessac - 33600';

    // When
    const location = parseLocation(text);

    // Then
    expect(location).toEqual({ city: 'Pessac', postalCode: '33600' });
  });

  it('comportement hérité : « La Teste de Buch 33260 » ne garde que « Buch » : le mot « de » de la marque De Tomaso arrête la ville', () => {
    // Given
    const text = 'La Teste de Buch 33260';

    // When
    const location = parseLocation(text);

    // Then
    expect(location).toEqual({ city: 'Buch', postalCode: '33260' });
  });

  it("« 33000 Bordeaux Porsche 911 », la ville s'arrête avant la marque", () => {
    // Given
    const text = '33000 Bordeaux Porsche 911';

    // When
    const location = parseLocation(text);

    // Then
    expect(location).toEqual({ city: 'Bordeaux', postalCode: '33000' });
  });
});
