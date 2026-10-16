import { describe, expect, it } from 'vitest';
import { announcedCount, classifyEmail } from '../../../src/domain/sites/emailKind.js';
import { notifiesTruncatedDigest, truncatedNewAdsDigest } from '../../../src/domain/sites/truncatedDigest.js';

const digestOf = (site: string | undefined, subject: string, received: number) =>
  truncatedNewAdsDigest({ site, kind: classifyEmail(subject), announced: announcedCount(subject), received });

describe('email de nouvelles annonces tronqué', () => {
  it('un email La Centrale « 61 nouveaux véhicules » qui n’en montre que 3 est tronqué, et l’écart vaut une notification', () => {
    // Given
    const subject = '61 nouveaux véhicules correspondent à votre recherche';

    // When
    const digest = digestOf('lacentrale', subject, 3);

    // Then
    expect(digest).toEqual({ site: 'lacentrale', announced: 61, received: 3 });
    expect(digest !== undefined && notifiesTruncatedDigest(digest)).toBe(true);
  });

  it('un email La Centrale « 6 nouveaux véhicules », qui n’en montre que 3 comme toujours, est tronqué de trois annonces : cela vaut une notification', () => {
    // Given
    const subject = '6 nouveaux véhicules correspondent à votre recherche';

    // When
    const digest = digestOf('lacentrale', subject, 3);

    // Then
    expect(digest).toEqual({ site: 'lacentrale', announced: 6, received: 3 });
    expect(digest !== undefined && notifiesTruncatedDigest(digest)).toBe(true);
  });

  it('un email La Centrale « 5 nouveaux véhicules », qui n’en montre que 3, est tronqué, mais deux annonces manquantes ne valent pas une notification', () => {
    // Given
    const subject = '5 nouveaux véhicules correspondent à votre recherche';

    // When
    const digest = digestOf('lacentrale', subject, 3);

    // Then
    expect(digest).toEqual({ site: 'lacentrale', announced: 5, received: 3 });
    expect(digest !== undefined && notifiesTruncatedDigest(digest)).toBe(false);
  });

  it('un email ParuVendu « 3 nouvelles annonces » qui montre ses trois annonces n’est pas tronqué', () => {
    // Given
    const subject = '🚗 3 nouvelles annonces - Voiture d’occasion / Bordeaux';

    // When
    const digest = digestOf('paruvendu', subject, 3);

    // Then
    expect(digest).toBeUndefined();
  });

  it('le récapitulatif La Centrale « 12 nouvelles annonces cette semaine », qui en montre 5, n’est pas un email de nouvelles annonces tronqué', () => {
    // Given
    const subject = 'Votre récapitulatif : 12 nouvelles annonces cette semaine';

    // When
    const digest = digestOf('lacentrale', subject, 5);

    // Then
    expect(digest).toBeUndefined();
  });

  it('l’alerte « 12 nouvelles annonces » d’un site absent du catalogue, dont aucune annonce n’a été reconnue, n’est rattachée à aucun site : pas de résumé tronqué', () => {
    // Given
    const subject = '12 nouvelles annonces correspondent à votre recherche';

    // When
    const digest = digestOf(undefined, subject, 0);

    // Then
    expect(digest).toBeUndefined();
  });
});
