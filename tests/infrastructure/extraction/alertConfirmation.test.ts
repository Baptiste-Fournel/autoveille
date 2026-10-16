import { describe, expect, it } from 'vitest';
import { detectAlertConfirmation } from '../../../src/domain/sites/confirmations.js';
import { cheerioListingExtractor } from '../../../src/infrastructure/extraction/cheerioListingExtractor.js';
import { fakeClock } from '../../fakes/fakeClock.js';
import { loadFixture } from '../../support/fixtures.js';

interface ReceivedEmail {
  readonly from: string;
  readonly subject: string;
  readonly html: string;
}

const RECEIVED_AT = new Date('2026-10-14T09:12:00.000Z');

const extractor = cheerioListingExtractor(fakeClock());

const confirmationOf = ({ from, subject, html }: ReceivedEmail) =>
  detectAlertConfirmation({ from, subject, ...extractor.visibleContent({ html }), date: RECEIVED_AT });

describe('emails de confirmation d’alerte des sites', () => {
  it("l'email de confirmation d'alerte La Centrale : 100 000 km, 33000, particuliers et la page de gestion des alertes", () => {
    // Given
    const html = loadFixture('emails/lacentrale/confirmation-de-creation-d-alerte.html');

    // When
    const confirmation = confirmationOf({ from: 'info@mail-alerte.lacentrale.fr', subject: '     Création de votre alerte ', html });

    // Then
    expect(confirmation).toMatchObject({ site: 'lacentrale', maxKm: 100000, postalCode: '33000', sellerType: 'particulier' });
    expect(confirmation?.criteria).toContain('100 000 km');
    expect(confirmation?.criteria).toContain('33000');
    expect(confirmation?.manageUrl).toBe('https://www.lacentrale.fr/compte/notification/recherche');
  });

  it("l'email de confirmation ParuVendu : critères en une phrase, rayon, kilométrage et lien « Modifier votre alerte »", () => {
    // Given
    const html = loadFixture('emails/paruvendu/confirmation-de-creation-d-alerte.html');

    // When
    const confirmation = confirmationOf({
      from: 'info@paruvendu.fr',
      subject: 'ParuVendu.fr - Confirmation de la création de votre alerte',
      html,
    });

    // Then
    expect(confirmation).toMatchObject({ site: 'paruvendu', radiusKm: 100, maxKm: 100000 });
    expect(confirmation?.criteria).toBe("Voiture d'occasion, Bordeaux (33000), Rayon de 100 km, Jusqu'à 100 000 km");
    expect(confirmation?.manageUrl).toContain('creationRecherche?idAlerte=8529668');
  });

  it("l'email de confirmation AutoScout24 est reconnu et mène à la page des recherches sauvegardées", () => {
    // Given
    const html = loadFixture('emails/autoscout24/confirmation-de-recherche-sauvegardee.html');

    // When
    const confirmation = confirmationOf({
      from: 'savedsearches@notifications.autoscout24.com',
      subject: 'Profil de recherche 14/10/2026 : ta recherche a bien été enregistrée',
      html,
    });

    // Then
    expect(confirmation).toMatchObject({ site: 'autoscout24' });
    expect(confirmation?.manageUrl).toBe('https://www.autoscout24.fr/account/searches');
  });

  it('la confirmation AutoScout24 lue dans son HTML : le nom donné à la recherche, « Profil de recherche 14/10/2026 », est retrouvé dans le texte visible', () => {
    // Given
    const html = loadFixture('emails/autoscout24/confirmation-de-recherche-sauvegardee.html');

    // When
    const confirmation = confirmationOf({
      from: 'savedsearches@notifications.autoscout24.com',
      subject: 'Profil de recherche 14/10/2026 : ta recherche a bien été enregistrée',
      html,
    });

    // Then
    expect(confirmation?.criteria).toBe('Recherche « Profil de recherche 14/10/2026 » enregistrée');
  });

  it("une confirmation d'inscription La Centrale, ParuVendu ou AutoScout24, ou une alerte de sécurité Google, n'est pas une confirmation d'alerte", () => {
    // Given
    const accountCreated = {
      from: 'no-reply@info1.lacentrale.fr',
      subject: 'Confirmation de votre inscription',
      html: loadFixture('emails/lacentrale/creation-de-compte.html'),
    };
    const accountToConfirm = {
      from: 'info@paruvendu.fr',
      subject: 'Création de votre alerte sur ParuVendu.fr',
      html: loadFixture('emails/paruvendu/compte-a-confirmer-avant-l-alerte.html'),
    };
    const addressToConfirm = {
      from: 'updates@info.autoscout24.com',
      subject: 'Tu y es presque – confirme ton e-mail',
      html: loadFixture('emails/autoscout24/adresse-email-a-confirmer.html'),
    };
    const securityAlert = { from: 'no-reply@accounts.google.com', subject: 'Alerte de sécurité', html: '<p>alerte</p>' };

    // When
    const confirmations = [accountCreated, accountToConfirm, addressToConfirm, securityAlert].map(confirmationOf);

    // Then
    expect(confirmations).toEqual([undefined, undefined, undefined, undefined]);
  });

  it('le vrai email La Centrale « 61 nouveaux véhicules » : son texte visible ne garde aucun des caractères invisibles qui remplissent l’aperçu', () => {
    // Given
    const html = loadFixture('emails/lacentrale/61-nouvelles-annonces-dont-3-en-apercu.html');

    // When
    const { text } = extractor.visibleContent({ html });

    // Then
    expect(text).toMatch(/^Découvrez les résultats de votre recherche Vos nouvelles alertes/);
    expect(text).not.toMatch(/[\u200B-\u200F\u00AD]|\u034F/);
  });
});
