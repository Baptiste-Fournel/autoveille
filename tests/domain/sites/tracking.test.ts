import { describe, expect, it } from 'vitest';
import { unwrapTrackingUrl } from '../../../src/domain/sites/tracking.js';

describe('lien de suivi des emails d’alerte', () => {
  it('un lien de suivi qui porte la destination en paramètre se déroule sans réseau ; un sous-domaine de suivi sans destination demande une résolution HTTP', () => {
    // Arrange
    const destinationInParameter = `https://links.notify.example.com/click?u=${encodeURIComponent('https://www.leboncoin.fr/ad/voitures/555555?utm=1')}`;
    const listingPage = 'https://www.paruvendu.fr/a/voiture-occasion/porsche/911/1234567890A1B';
    const trackingSubdomain = 'https://t.paruvendu.fr/x/y';

    // Act
    const u = unwrapTrackingUrl(destinationInParameter);
    const direct = unwrapTrackingUrl(listingPage);
    const tracked = unwrapTrackingUrl(trackingSubdomain);

    // Assert
    expect(u).toEqual({ url: 'https://www.leboncoin.fr/ad/voitures/555555?utm=1', resolved: true });
    expect(direct.resolved).toBe(true);
    expect(tracked.resolved).toBe(false);
  });

  it('un lien de suivi « /click/https://www.leboncoin.fr/… » se déroule sans réseau, que la destination soit écrite en clair ou encodée', () => {
    // Arrange
    const plainLink = 'https://click.mailing.example.com/click/https://www.leboncoin.fr/ad/voitures/2811001234';
    const encodedLink = 'https://click.mailing.example.com/click/https%3A%2F%2Fwww.leboncoin.fr%2Fad%2Fvoitures%2F2811001234';

    // Act
    const plain = unwrapTrackingUrl(plainLink);
    const encoded = unwrapTrackingUrl(encodedLink);

    // Assert
    expect(plain).toEqual({ url: 'https://www.leboncoin.fr/ad/voitures/2811001234', resolved: true });
    expect(encoded).toEqual({ url: 'https://www.leboncoin.fr/ad/voitures/2811001234', resolved: true });
  });

  it('un lien de suivi La Centrale sans destination lisible (« clicks.mail-alerte.lacentrale.fr/f/a/… ») attend une résolution HTTP', () => {
    // Arrange
    const link = 'https://clicks.mail-alerte.lacentrale.fr/f/a/t4~~/AAAHahA~/x';

    // Act
    const unwrapped = unwrapTrackingUrl(link);

    // Assert
    expect(unwrapped).toEqual({ url: 'https://clicks.mail-alerte.lacentrale.fr/f/a/t4~~/AAAHahA~/x', resolved: false });
  });

  it("le lien d'un site inconnu sans motif de suivi est pris tel quel, sans résolution HTTP", () => {
    // Arrange
    const link = 'https://www.petit-site-auto.fr/annonce/porsche-911-carrera-4s-2015/987654';

    // Act
    const unwrapped = unwrapTrackingUrl(link);

    // Assert
    expect(unwrapped).toEqual({ url: 'https://www.petit-site-auto.fr/annonce/porsche-911-carrera-4s-2015/987654', resolved: true });
  });

  it("un lien de suivi dont l'adresse garde un « % » isolé (« promo=-10% ») se déroule quand même : le décodage impossible est ignoré", () => {
    // Arrange
    const link = 'https://tracking.example.com/click/https://www.leboncoin.fr/ad/voitures/2811001234?promo=-10%';

    // Act
    const unwrapped = unwrapTrackingUrl(link);

    // Assert
    expect(unwrapped).toEqual({ url: 'https://www.leboncoin.fr/ad/voitures/2811001234?promo=-10%', resolved: true });
  });
});
