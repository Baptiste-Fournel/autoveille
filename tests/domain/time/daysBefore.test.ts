import { describe, expect, it } from 'vitest';
import { daysBefore } from '../../../src/domain/time/daysBefore.js';

describe('une fenêtre de jours comptée depuis maintenant', () => {
  it('les écartées de la quinzaine, ouvertes le 15 octobre à 8 h 30, remontent au 1er octobre à la même heure', () => {
    // Given
    const now = '2026-10-15T08:30:00.000Z';

    // When
    const since = daysBefore(now, 14);

    // Then
    expect(since).toBe('2026-10-01T08:30:00.000Z');
  });

  it('la semaine de l’accueil, ouverte le lundi 2 novembre, compte sept fois 24 heures malgré le passage à l’heure d’hiver du 25 octobre', () => {
    // Given
    const now = '2026-11-02T07:00:00.000Z';

    // When
    const since = daysBefore(now, 7);

    // Then
    expect(since).toBe('2026-10-26T07:00:00.000Z');
  });
});
