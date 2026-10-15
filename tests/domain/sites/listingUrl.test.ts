import { describe, expect, it } from 'vitest';
import { SITES, type SiteDef } from '../../../src/domain/sites/catalog.js';
import { listingRef } from '../../../src/domain/sites/listingUrl.js';

const siteOf = (key: string): SiteDef | undefined => SITES.find((site) => site.key === key);

describe("adresse d'une page d'annonce", () => {
  it("une annonce AutoScout24 au slug plein de tirets garde l'uuid entier comme identifiant ; un petit site inconnu est reconnu à son chemin", () => {
    // Arrange
    const annonce = 'https://www.autoscout24.fr/annonces/porsche-911-carrera-essence-noir-12345678-1234-1234-1234-123456789abc';
    const offreWithTracking =
      'https://www.autoscout24.fr/offres/bmw-z4-sdrive20i-197-ch-bvm6-essence-gris-cat_ma13mo18308-8723275b-cdc4-4a58-811d-ae9cef84c6f3?cldtidx=0&ap_tier=t30';
    const shortOffre = 'https://www.autoscout24.fr/offres/8723275b-cdc4-4a58-811d-ae9cef84c6f3';
    const paruVendu = 'https://www.paruvendu.fr/a/voiture-occasion/porsche/911/1234567890A1B';
    const leboncoinSearch = 'https://www.leboncoin.fr/recherches/123';
    const smallSiteListing = 'https://www.petit-site-auto.fr/annonce/porsche-911-carrera-4s-2015/987654';
    const smallSiteHelp = 'https://www.petit-site-auto.fr/aide/contact/987654';

    // Act
    const [annonceRef, offre, shortOffreRef, paruVenduRef, search, generic, help] = [
      annonce,
      offreWithTracking,
      shortOffre,
      paruVendu,
      leboncoinSearch,
      smallSiteListing,
      smallSiteHelp,
    ].map((href) => listingRef(href));

    // Assert
    expect(annonceRef?.id).toBe('12345678-1234-1234-1234-123456789abc');
    expect(offre?.id).toBe('8723275b-cdc4-4a58-811d-ae9cef84c6f3');
    expect(offre?.url).toBe(
      'https://www.autoscout24.fr/offres/bmw-z4-sdrive20i-197-ch-bvm6-essence-gris-cat_ma13mo18308-8723275b-cdc4-4a58-811d-ae9cef84c6f3',
    );
    expect(shortOffreRef?.id).toBe('8723275b-cdc4-4a58-811d-ae9cef84c6f3');
    expect(paruVenduRef?.id).toBe('1234567890A1B');
    expect(search).toBeUndefined();
    expect(generic).toMatchObject({ site: 'petit-site-auto.fr', siteLabel: 'Petit-site-auto', id: '987654' });
    expect(help).toBeUndefined();
  });

  it('dans un email AutoScout24, les liens App Store et Play Store du pied de page ne sont pas des annonces', () => {
    // Arrange
    const autoScout24 = siteOf('autoscout24');

    // Act
    const appStore = listingRef('https://apps.apple.com/us/app/autoscout24-buying-leasing/id311785642?pt=229724', autoScout24);
    const playStore = listingRef('https://play.google.com/store/apps/details?id=com.autoscout24', autoScout24);

    // Assert
    expect(appStore).toBeUndefined();
    expect(playStore).toBeUndefined();
  });

  it("dans un email Leboncoin, un lien vers la page d'annonce d'un autre site n'est pas une annonce, alors qu'il en serait une dans l'email d'un site inconnu", () => {
    // Arrange
    const otherSitePage = 'https://www.petit-site-auto.fr/annonce/porsche-911-carrera-4s-2015/987654';

    // Act
    const inLeboncoinEmail = listingRef(otherSitePage, siteOf('leboncoin'));
    const inUnknownSiteEmail = listingRef(otherSitePage);

    // Assert
    expect(inLeboncoinEmail).toBeUndefined();
    expect(inUnknownSiteEmail).toMatchObject({ site: 'petit-site-auto.fr', id: '987654' });
  });

  it("une annonce ParuVendu ouverte depuis l'email d'alerte perd ses paramètres de suivi (idAlerte, ticket, xtor, mailUniqId)", () => {
    // Arrange
    const fromAlertEmail =
      'https://www.paruvendu.fr/a/voiture-occasion/audi/tt/1296277822A1KVVOAUTT?idAlerte=1&ticket=x&xtor=EPR-48-[Alertes_Auto]-20261015&mailUniqIdAno=0&mailUniqId=0';

    // Act
    const ref = listingRef(fromAlertEmail);

    // Assert
    expect(ref).toEqual({
      site: 'paruvendu',
      siteLabel: 'ParuVendu',
      id: '1296277822A1KVVOAUTT',
      url: 'https://www.paruvendu.fr/a/voiture-occasion/audi/tt/1296277822A1KVVOAUTT',
    });
  });
});
