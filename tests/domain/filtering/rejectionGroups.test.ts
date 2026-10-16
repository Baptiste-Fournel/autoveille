import { describe, expect, it } from 'vitest';
import { rejectionGroupOf } from '../../../src/domain/filtering/rejectionGroups.js';
import type { RejectionReason } from '../../../src/domain/filtering/verdict.js';

describe('groupes de l’écran « Écartées »', () => {
  it('les écartées se rangent par raison : autres marques, ni supercar ni collection, vendeur pro, trop loin, trop de km', () => {
    // Given
    const reasons: readonly RejectionReason[] = [
      { kind: 'unfollowedBrand', make: 'Dacia' },
      { kind: 'unknownBrand' },
      { kind: 'notSpecial' },
      { kind: 'professionalSeller' },
      { kind: 'outsideRadius', distanceKm: 140, radiusKm: 100 },
      { kind: 'mileageAbove', km: 120000, maxKm: 100000 },
    ];

    // When
    const groups = reasons.map(rejectionGroupOf);

    // Then
    expect(groups).toEqual(['marque', 'marque', 'special', 'pro', 'loin', 'km']);
  });

  it('une Volkswagen écartée parce que la marque est décochée chez les allemandes se range avec les autres marques', () => {
    // Given
    const reason: RejectionReason = { kind: 'disabledBrand', make: 'Volkswagen' };

    // When
    const group = rejectionGroupOf(reason);

    // Then
    expect(group).toBe('marque');
  });
});
