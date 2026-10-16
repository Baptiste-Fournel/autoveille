import { describe, expect, it } from 'vitest';
import { cryptoRandom } from '../../../src/infrastructure/system/cryptoRandom.js';

describe('tirages aléatoires de l’application', () => {
  it('un jeton de session tiré sur 32 octets fait 64 caractères hexadécimaux, et deux connexions n’ont jamais le même', () => {
    // Given
    const bytes = 32;

    // When
    const phone = cryptoRandom.hexToken(bytes);
    const computer = cryptoRandom.hexToken(bytes);

    // Then
    expect(phone).toMatch(/^[0-9a-f]{64}$/);
    expect(computer).not.toBe(phone);
  });

  it('un site lu directement ajouté sans identifiant reçoit un identifiant court de huit lettres ou chiffres', () => {
    // Given
    const draws = 200;

    // When
    const ids = Array.from({ length: draws }, () => cryptoRandom.shortId());

    // Then
    for (const id of ids) {
      expect(id).toMatch(/^[0-9a-z]{8}$/);
    }
    expect(new Set(ids).size).toBe(draws);
  });
});
