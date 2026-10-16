import { describe, expect, it } from 'vitest';
import { cheerioListingExtractor } from '../../../src/infrastructure/extraction/cheerioListingExtractor.js';
import { fakeClock } from '../../fakes/fakeClock.js';
import { loadFixture } from '../../support/fixtures.js';

const extractor = cheerioListingExtractor(fakeClock());

const GARAGE_PAGE = 'pages/resultats-json-ld-produits-avec-offres-et-un-bloc-illisible.html';

describe('pages de résultats décrites en JSON-LD', () => {
  it('une page de résultats qui décrit ses voitures en JSON-LD schema.org Car', () => {
    // Given
    const html = loadFixture('pages/resultats-json-ld-une-voiture.html');

    // When
    const reading = extractor.listingsFromPage({ url: 'https://www.example-auto.fr/recherche', html });

    // Then
    expect(reading.method).toBe('structuredData');
    expect(reading.listings).toHaveLength(1);
    expect(reading.listings[0]).toMatchObject({
      site: 'example-auto.fr',
      externalId: '123456',
      title: 'Porsche 911 Carrera S',
      year: 2015,
      km: 42000,
      price: 89900,
      sellerType: 'particulier',
      city: 'Mérignac',
    });
  });

  it('un garage qui décrit ses occasions en Product avec offres : prix, vendeur professionnel, ville et photo de l’Alpine sont lus, et la housse de la boutique n’est pas une annonce', () => {
    // Given
    const html = loadFixture(GARAGE_PAGE);

    // When
    const reading = extractor.listingsFromPage({ url: 'https://www.garage-exemple.fr/occasions', html });

    // Then
    expect(reading).toEqual({
      method: 'structuredData',
      listings: [
        {
          site: 'garage-exemple.fr',
          siteLabel: 'Garage-exemple',
          externalId: '445566',
          url: 'https://www.garage-exemple.fr/occasion/alpine-a110/445566',
          title: 'Alpine A110 Légende 252ch',
          price: 58900,
          km: 21000,
          year: 2019,
          city: 'Arcachon',
          postalCode: '33120',
          sellerType: 'pro',
          imageUrl: 'https://cdn.garage-exemple.fr/alpine-a110.jpg',
        },
      ],
    });
  });

  it('un bloc JSON-LD illisible (coupé avant sa fin) à côté de celui des occasions est ignoré, et les occasions sont lues', () => {
    // Given
    const html = loadFixture(GARAGE_PAGE);

    // When
    const reading = extractor.listingsFromPage({ url: 'https://www.garage-exemple.fr/occasions', html });

    // Then
    expect(reading.method).toBe('structuredData');
    expect(reading.listings.map((listing) => listing.title)).toEqual(['Alpine A110 Légende 252ch']);
  });
});
