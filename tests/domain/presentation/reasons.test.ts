import { describe, expect, it } from 'vitest';
import type { RejectionReason } from '../../../src/domain/filtering/verdict.js';
import { describeRejection } from '../../../src/domain/presentation/reasons.js';

describe('raisons affichées sur l’écran « Écartées »', () => {
  it('une Mazda MX-5 reçue dans une alerte s’affiche « marque Mazda hors des familles suivies »', () => {
    // Given
    const reason: RejectionReason = { kind: 'unfollowedBrand', make: 'Mazda' };

    // When
    const sentence = describeRejection(reason);

    // Then
    expect(sentence).toBe('marque Mazda hors des familles suivies');
  });

  it('une Zastava Yugo, marque absente du catalogue, s’affiche « marque non reconnue »', () => {
    // Given
    const reason: RejectionReason = { kind: 'unknownBrand' };

    // When
    const sentence = describeRejection(reason);

    // Then
    expect(sentence).toBe('marque non reconnue');
  });

  it('une Golf GTI alors que Volkswagen est décochée chez les allemandes s’affiche « marque Volkswagen désactivée »', () => {
    // Given
    const reason: RejectionReason = { kind: 'disabledBrand', make: 'Volkswagen' };

    // When
    const sentence = describeRejection(reason);

    // Then
    expect(sentence).toBe('marque Volkswagen désactivée');
  });

  it('une Clio 1.2 à 7 500 € s’affiche « ni supercar ni collection selon les réglages »', () => {
    // Given
    const reason: RejectionReason = { kind: 'notSpecial' };

    // When
    const sentence = describeRejection(reason);

    // Then
    expect(sentence).toBe('ni supercar ni collection selon les réglages');
  });

  it('une 911 vendue par un garage, avec « Particuliers uniquement » coché, s’affiche « vendeur professionnel »', () => {
    // Given
    const reason: RejectionReason = { kind: 'professionalSeller' };

    // When
    const sentence = describeRejection(reason);

    // Then
    expect(sentence).toBe('vendeur professionnel');
  });

  it('une 911 à 142 000 km avec un plafond de 100 000 km s’affiche « 142 000 km, au-dessus de 100 000 km »', () => {
    // Given
    const reason: RejectionReason = { kind: 'mileageAbove', km: 142000, maxKm: 100000 };

    // When
    const sentence = describeRejection(reason);

    // Then
    expect(sentence).toBe('142 000 km, au-dessus de 100 000 km');
  });

  it('une annonce de Montauban, à 178,6 km de Bordeaux, s’affiche « à 179 km » : la distance n’est arrondie qu’à l’affichage', () => {
    // Given
    const reason: RejectionReason = { kind: 'outsideRadius', distanceKm: 178.6, radiusKm: 100 };

    // When
    const sentence = describeRejection(reason);

    // Then
    expect(sentence).toBe('à 179 km, hors du rayon de 100 km');
  });
});
