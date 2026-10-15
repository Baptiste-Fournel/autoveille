import { describe, expect, it } from 'vitest';
import { alertMismatch, detectAlertConfirmation } from './confirmations.js';
import { defaultSettings } from '../../listings/defaults.js';
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

  it('flags a site alert narrower than the app settings', () => {
    const s = defaultSettings(); // 100 km, 100 000 km
    expect(alertMismatch({ site: 'paruvendu', criteria: '', radiusKm: 100, maxKm: 100000, confirmedAt: 'x' }, s)).toEqual([]);
    const narrow = alertMismatch({ site: 'paruvendu', criteria: '', radiusKm: 50, maxKm: 80000, confirmedAt: 'x' }, s);
    expect(narrow).toHaveLength(2);
    expect(narrow[0]).toContain('50 km');
    expect(narrow[1]).toContain('80 000 km');
    // A wider alert is fine: the app does the fine filtering.
    expect(alertMismatch({ site: 'paruvendu', criteria: '', radiusKm: 200, maxKm: 150000, confirmedAt: 'x' }, s)).toEqual([]);
  });
});

describe('alert width', () => {
  it('recommends a net wider than the settings, and says so when the alert is tight', async () => {
    const { alertBounds } = await import('../links.js');
    const { alertAdvice } = await import('./confirmations.js');
    const { defaultSettings } = await import('../../listings/defaults.js');
    const settings = defaultSettings();
    settings.zone.radiusKm = 100; settings.maxKm = 100000;
    expect(alertBounds(settings)).toEqual({ radiusKm: 150, maxKm: 150000 });
    expect(alertAdvice({ site: 'lacentrale', criteria: '', confirmedAt: '', radiusKm: 100, maxKm: 100000 }, settings)).toMatch(/150 km de rayon, 150 000 km au compteur/);
    // ParuVendu stops at 100 km: only the mileage can be widened there.
    expect(alertAdvice({ site: 'paruvendu', criteria: '', confirmedAt: '', radiusKm: 100, maxKm: 100000 }, settings)).toMatch(/\(150 000 km au compteur\)/);
    expect(alertAdvice({ site: 'paruvendu', criteria: '', confirmedAt: '', radiusKm: 200, maxKm: 150000 }, settings)).toBeUndefined();
    expect(alertAdvice({ site: 'autoscout24', criteria: '', confirmedAt: '' }, settings)).toBeUndefined();
  });
});
