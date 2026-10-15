import { describe, expect, it } from 'vitest';
import { formatInteger } from '../../../src/domain/presentation/numbers.js';

describe('nombres affichés', () => {
  it('un kilométrage formaté puis copié ne contient aucune espace insécable', () => {
    // Given
    const km = 142000;

    // When
    const shown = formatInteger(km);

    // Then
    expect(shown).toBe('142 000');
    expect(shown).not.toMatch(/[\u00a0\u202f]/);
  });

  it('un prix au million garde une espace simple entre chaque groupe de trois chiffres', () => {
    // Given
    const price = 1200000;

    // When
    const shown = formatInteger(price);

    // Then
    expect(shown).toBe('1 200 000');
  });
});
