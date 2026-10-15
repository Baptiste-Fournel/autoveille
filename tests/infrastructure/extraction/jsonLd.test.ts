import { describe, expect, it } from 'vitest';
import { listingsFromJsonLd } from '../../../src/sources/http.js';
import { loadFixture } from '../../support/fixtures.js';

describe('pages de résultats décrites en JSON-LD', () => {
  it('une page de résultats qui décrit ses voitures en JSON-LD schema.org Car', () => {
    // Given
    const html = loadFixture('pages/resultats-json-ld-une-voiture.html');

    // When
    const listings = listingsFromJsonLd(html, 'https://www.example-auto.fr/recherche');

    // Then
    expect(listings).toHaveLength(1);
    expect(listings[0]).toMatchObject({
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
});
