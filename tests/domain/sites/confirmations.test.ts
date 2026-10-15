import { describe, expect, it } from 'vitest';
import { alertMismatchSentence } from '../../../src/domain/presentation/alerts.js';
import { defaultSettings } from '../../../src/domain/settings/defaults.js';
import type { AlertInfo } from '../../../src/domain/settings/types.js';
import { alertMismatch, detectAlertConfirmation, type ExtractedEmail } from '../../../src/domain/sites/confirmations.js';

const receivedAt = new Date('2026-10-14T09:12:00Z');

const email = (fields: Omit<ExtractedEmail, 'links' | 'date'> & Partial<Pick<ExtractedEmail, 'links'>>): ExtractedEmail => ({
  links: [],
  date: receivedAt,
  ...fields,
});

describe("email de confirmation d'alerte, sur le texte déjà extrait", () => {
  it("l'email La Centrale « Création de votre alerte » : 100 000 km, 33000 et particuliers, avec la page de gestion des alertes du site", () => {
    // Arrange
    const confirmation = email({
      from: 'info@mail-alerte.lacentrale.fr',
      subject: '     Création de votre alerte ',
      text: 'Votre alerte est confirmée, vous serez informé des nouveautés ! Votre alerte est activée Votre recherche de véhicule est enregistrée. Gérez vos alertes, quand vous le souhaitez, en vous connectant à . votre compte Recherche Kilométrage ... 100000 km Localisation 33000 (rayon de 1... Type de vendeur Particulier Pourquoi choisir la centrale ?',
      links: [{ text: 'votre compte', href: 'https://clicks.mail-alerte.lacentrale.fr/f/a/abc' }],
    });

    // Act
    const alert = detectAlertConfirmation(confirmation);

    // Assert
    expect(alert).toEqual({
      site: 'lacentrale',
      confirmedAt: '2026-10-14T09:12:00.000Z',
      manageUrl: 'https://www.lacentrale.fr/compte/notification/recherche',
      criteria: '100 000 km max, 33000, particuliers',
      maxKm: 100000,
      postalCode: '33000',
      sellerType: 'particulier',
    });
  });

  it("l'email ParuVendu : la phrase des critères découpée en parties, le rayon, le kilométrage et le lien « Modifier votre alerte » de l'email", () => {
    // Arrange
    const confirmation = email({
      from: 'info@paruvendu.fr',
      subject: 'ParuVendu.fr - Confirmation de la création de votre alerte',
      text: "Bonjour Prénom, Nous vous confirmons l'enregistrement de votre alerte mail. Nom de la recherche : Voiture d'occasion sur un rayon de 100 km / kilométrage maxi : 100000. Vos critères de recherche : Voiture d'occasion Bordeaux (33000) Rayon de 100 km Jusqu'à 100 000 km » Voir les annonces » Modifier votre alerte Si vous souhaitez suspendre l'envoi des nouvelles annonces par mail, cliquez ici",
      links: [
        { text: '» Voir les annonces', href: 'https://www.paruvendu.fr/auto-moto/annonceautofo/alerte/liste?idAlerte=8529668&ticket=x' },
        {
          text: '» Modifier votre alerte',
          href: 'https://www.paruvendu.fr/utilisateurparticulierfo/default/creationRecherche?idAlerte=8529668&ticket=x',
        },
      ],
    });

    // Act
    const alert = detectAlertConfirmation(confirmation);

    // Assert
    expect(alert).toEqual({
      site: 'paruvendu',
      confirmedAt: '2026-10-14T09:12:00.000Z',
      manageUrl: 'https://www.paruvendu.fr/utilisateurparticulierfo/default/creationRecherche?idAlerte=8529668&ticket=x',
      criteria: "Voiture d'occasion, Bordeaux (33000), Rayon de 100 km, Jusqu'à 100 000 km",
      radiusKm: 100,
      maxKm: 100000,
      postalCode: '33000',
    });
  });

  it("l'email AutoScout24 « ta recherche a bien été enregistrée » : le nom de la recherche, sans critères, et la page des recherches sauvegardées", () => {
    // Arrange
    const confirmation = email({
      from: 'savedsearches@notifications.autoscout24.com',
      subject: 'Profil de recherche 14/10/2026 : ta recherche a bien été enregistrée',
      text: 'De nouvelles offres sont en route ! Ta recherche Profil de recherche 14/10/2026 a été enregistrée. Reçois à partir de maintenant par e-mail les nouvelles offres correspondant à cette recherche. Voir les nouvelles annonces',
    });

    // Act
    const alert = detectAlertConfirmation(confirmation);

    // Assert
    expect(alert).toEqual({
      site: 'autoscout24',
      confirmedAt: '2026-10-14T09:12:00.000Z',
      manageUrl: 'https://www.autoscout24.fr/account/searches',
      criteria: 'Recherche « Profil de recherche 14/10/2026 » enregistrée',
    });
  });

  it('une recherche sauvegardée sur Leboncoin (texte reconstitué, aucun vrai email reçu) : les critères, le rayon et le kilométrage annoncés', () => {
    // Arrange
    const confirmation = email({
      from: 'no-reply@leboncoin.fr',
      subject: 'Votre recherche a bien été sauvegardée',
      text: 'Votre recherche a bien été sauvegardée. Vos critères : Voitures, Bordeaux et 150 km autour, kilométrage max 150 000 km. Vous recevrez un email à chaque nouvelle annonce.',
    });

    // Act
    const alert = detectAlertConfirmation(confirmation);

    // Assert
    expect(alert).toEqual({
      site: 'leboncoin',
      confirmedAt: '2026-10-14T09:12:00.000Z',
      manageUrl: 'https://www.leboncoin.fr/mes-recherches',
      criteria: 'Voitures, Bordeaux et 150 km autour, kilométrage max 150 000 km',
      radiusKm: 150,
      maxKm: 150000,
    });
  });

  it("l'email « Votre alerte est créée » d'un site sans format connu (L'argus, texte reconstitué, aucun vrai email reçu) compte comme confirmation", () => {
    // Arrange
    const confirmation = email({
      from: 'alertes@largus.fr',
      subject: 'Votre alerte est créée',
      text: 'Vous recevrez les nouvelles annonces correspondant à votre recherche dès leur publication.',
    });

    // Act
    const alert = detectAlertConfirmation(confirmation);

    // Assert
    expect(alert).toEqual({ site: 'largus', confirmedAt: '2026-10-14T09:12:00.000Z', manageUrl: undefined, criteria: 'Alerte créée' });
  });

  it("un email d'un expéditeur qui n'est pas un site d'annonces (alerte de sécurité Google) n'est jamais une confirmation d'alerte", () => {
    // Arrange
    const securityAlert = email({ from: 'no-reply@accounts.google.com', subject: 'Alerte de sécurité', text: 'alerte' });

    // Act
    const alert = detectAlertConfirmation(securityAlert);

    // Assert
    expect(alert).toBeUndefined();
  });
});

describe('alerte de site plus étroite que les réglages', () => {
  it("une alerte ParuVendu à 50 km et 80 000 km est signalée plus étroite que les réglages par défaut (100 km, 100 000 km) ; une alerte plus large ne l'est pas", () => {
    // Arrange
    const s = defaultSettings();
    const sentences = (alert: AlertInfo): readonly string[] => alertMismatch(alert, s).map(alertMismatchSentence);
    const atSettings: AlertInfo = { site: 'paruvendu', criteria: '', radiusKm: 100, maxKm: 100000, confirmedAt: 'x' };
    const narrower: AlertInfo = { site: 'paruvendu', criteria: '', radiusKm: 50, maxKm: 80000, confirmedAt: 'x' };
    const wider: AlertInfo = { site: 'paruvendu', criteria: '', radiusKm: 200, maxKm: 150000, confirmedAt: 'x' };

    // Act
    const [same, narrow, wide] = [atSettings, narrower, wider].map(sentences);

    // Assert
    expect(same).toEqual([]);
    expect(narrow).toHaveLength(2);
    expect(narrow?.[0]).toContain('50 km');
    expect(narrow?.[1]).toContain('80 000 km');
    expect(wide).toEqual([]);
  });

  it('une alerte ParuVendu à 50 km et 80 000 km : les deux écarts disent ce que couvre le site et ce que demandent les réglages', () => {
    // Arrange
    const narrower: AlertInfo = { site: 'paruvendu', criteria: '', radiusKm: 50, maxKm: 80000, confirmedAt: 'x' };

    // Act
    const mismatches = alertMismatch(narrower, defaultSettings());

    // Assert
    expect(mismatches).toEqual([
      { kind: 'radiusNarrower', alertRadiusKm: 50, settingsRadiusKm: 100 },
      { kind: 'mileageNarrower', alertMaxKm: 80000, settingsMaxKm: 100000 },
    ]);
  });
});
