import { describe, expect, it } from 'vitest';
import { detectAlertConfirmation } from './confirmations.js';
import { loadFixture } from '../../../tests/support/fixtures.js';

// Texts as the sites' confirmation emails render them (14/10/2026), reduced to what matters.
const LACENTRALE = loadFixture('emails/lacentrale/confirmation-de-creation-d-alerte.html');

const PARUVENDU = loadFixture('emails/paruvendu/confirmation-de-creation-d-alerte.html');

const AUTOSCOUT = loadFixture('emails/autoscout24/confirmation-de-recherche-sauvegardee.html');

describe('alert confirmation emails', () => {
  it('reads La Centrale: km, postal code, seller type, and the page to manage the alert', () => {
    const c = detectAlertConfirmation({ from: 'info@mail-alerte.lacentrale.fr', subject: '     Création de votre alerte ', html: LACENTRALE });
    expect(c).toMatchObject({ site: 'lacentrale', maxKm: 100000, postalCode: '33000', sellerType: 'particulier' });
    expect(c!.criteria).toContain('100 000 km');
    expect(c!.criteria).toContain('33000');
    expect(c!.manageUrl).toBe('https://www.lacentrale.fr/compte/notification/recherche');
  });

  it('reads ParuVendu: criteria sentence, radius, km, and the "modify" link of the email', () => {
    const c = detectAlertConfirmation({ from: 'info@paruvendu.fr', subject: 'ParuVendu.fr - Confirmation de la création de votre alerte', html: PARUVENDU });
    expect(c).toMatchObject({ site: 'paruvendu', radiusKm: 100, maxKm: 100000 });
    expect(c!.criteria).toBe("Voiture d'occasion, Bordeaux (33000), Rayon de 100 km, Jusqu'à 100 000 km");
    expect(c!.manageUrl).toContain('creationRecherche?idAlerte=8529668');
  });

  it('reads AutoScout24: the saved search, without criteria in the email', () => {
    const c = detectAlertConfirmation({ from: 'savedsearches@notifications.autoscout24.com', subject: 'Profil de recherche 14/10/2026 : ta recherche a bien été enregistrée', html: AUTOSCOUT });
    expect(c).toMatchObject({ site: 'autoscout24' });
    expect(c!.manageUrl).toBe('https://www.autoscout24.fr/account/searches');
  });

  it('ignores the other emails of the same senders', () => {
    expect(detectAlertConfirmation({ from: 'no-reply@info1.lacentrale.fr', subject: 'Confirmation de votre inscription', html: loadFixture('emails/lacentrale/creation-de-compte.html') })).toBeUndefined();
    expect(detectAlertConfirmation({ from: 'info@paruvendu.fr', subject: 'Création de votre alerte sur ParuVendu.fr', html: loadFixture('emails/paruvendu/compte-a-confirmer-avant-l-alerte.html') })).toBeUndefined();
    expect(detectAlertConfirmation({ from: 'updates@info.autoscout24.com', subject: 'Tu y es presque – confirme ton e-mail', html: loadFixture('emails/autoscout24/adresse-email-a-confirmer.html') })).toBeUndefined();
    expect(detectAlertConfirmation({ from: 'no-reply@accounts.google.com', subject: 'Alerte de sécurité', html: '<p>alerte</p>' })).toBeUndefined();
  });
});
