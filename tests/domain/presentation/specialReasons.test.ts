import { describe, expect, it } from 'vitest';
import type { SpecialReason } from '../../../src/domain/filtering/verdict.js';
import { describeSpecialReason } from '../../../src/domain/presentation/specialReasons.js';

describe('pourquoi une annonce est retenue', () => {
  it('une Mercedes GLE à 52 000 €, retenue par le prix plancher des allemandes, porte le badge « prix ≥ 40 000 € »', () => {
    // Given
    const reason: SpecialReason = { kind: 'priceFloor', minPrice: 40000 };

    // When
    const sentence = describeSpecialReason(reason);

    // Then
    expect(sentence).toBe('prix ≥ 40 000 €');
  });

  it('une Mercedes 190 E de 1989, retenue comme voiture de collection, porte le badge « année ≤ 1995 »', () => {
    // Given
    const reason: SpecialReason = { kind: 'yearCap', maxYear: 1995 };

    // When
    const sentence = describeSpecialReason(reason);

    // Then
    expect(sentence).toBe('année ≤ 1995');
  });

  it('une 911 retenue par son mot-clé porte le badge « modèle « 911 » »', () => {
    // Given
    const reason: SpecialReason = { kind: 'keyword', keyword: '911' };

    // When
    const sentence = describeSpecialReason(reason);

    // Then
    expect(sentence).toBe('modèle « 911 »');
  });
});
