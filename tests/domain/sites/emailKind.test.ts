import { describe, expect, it } from 'vitest';
import { announcedCount, classifyEmail, isDigestOfOlderAds } from '../../../src/domain/sites/emailKind.js';

describe('sujet d’un email d’alerte', () => {
  it('nouvelles annonces, baisses de prix, relances et récapitulatifs se reconnaissent au sujet de l’email, quel que soit le site', () => {
    // Arrange
    const subjects = [
      '61 nouveaux véhicules correspondent à votre recherche',
      '🚗 1 nouvelle annonce - Voiture d’occasion / Bordeaux',
      'Profil de recherche 14/10/2026 : 2 nouveaux résultats',
      '↘️ 108 baisses de prix sur votre alerte',
      'Toujours intéressé par "Audi TT - 39900 €" ?',
      'Votre récapitulatif de la semaine',
      'Confirmation de la création de votre alerte',
    ];
    const counted = ['61 nouveaux véhicules correspondent à votre recherche', '🚗 1 nouvelle annonce - Voiture', 'Toujours intéressé ?'];

    // Act
    const [laCentrale, leboncoin, autoScout24, priceDrops, reminder, recap, confirmation] = subjects.map(classifyEmail);
    const [sixtyOne, one, none] = counted.map(announcedCount);

    // Assert
    expect(laCentrale).toBe('new');
    expect(leboncoin).toBe('new');
    expect(autoScout24).toBe('new');
    expect(priceDrops).toBe('price_drop');
    expect(reminder).toBe('reminder');
    expect(recap).toBe('recap');
    expect(confirmation).toBe('other');
    expect(sixtyOne).toBe(61);
    expect(one).toBe(1);
    expect(none).toBeUndefined();
  });

  it('les baisses de prix, relances et récapitulatifs reviennent sur des annonces publiées plus tôt, pas les nouvelles annonces', () => {
    // Arrange
    const priceDropsSubject = '↘️ 108 baisses de prix sur votre alerte';
    const reminderSubject = 'Toujours intéressé par "Audi TT - 39900 €" ?';
    const recapSubject = 'Votre récapitulatif de la semaine';
    const freshAdsSubject = '61 nouveaux véhicules correspondent à votre recherche';

    // Act
    const priceDrops = isDigestOfOlderAds(priceDropsSubject);
    const reminder = isDigestOfOlderAds(reminderSubject);
    const recap = isDigestOfOlderAds(recapSubject);
    const freshAds = isDigestOfOlderAds(freshAdsSubject);

    // Assert
    expect([priceDrops, reminder, recap]).toEqual([true, true, true]);
    expect(freshAds).toBe(false);
  });
});
