import { describe, expect, it } from 'vitest';
import { attachmentOf, sameVehicleAmong } from '../../../src/domain/ingest/identify.js';
import { extractVehicleInfo } from '../../../src/domain/parsing/vehicleInfo.js';
import { knownListing, knownVehicle } from '../../support/knownVehicle.js';
import { rawListing } from '../../support/rawListing.js';

const infoOf = (title: string) => extractVehicleInfo(rawListing(title), { customBrands: [], currentYear: 2026 });

describe('reconnaître une voiture déjà connue sous un nouvel identifiant', () => {
  it('une 911 Carrera S republiée à 43 000 km et 88 500 € est la voiture déjà connue à 42 000 km et 89 900 €', () => {
    // Given
    const known = knownVehicle({ km: 42000, price: 89900 });

    // When
    const found = sameVehicleAmong([known], infoOf('Porsche 911 Carrera S 2015 43 000 km 88 500 €'));

    // Then
    expect(found).toBe(known);
  });

  it('une 911 Carrera S de même empreinte mais à 95 000 km est une autre voiture', () => {
    // Given
    const known = knownVehicle({ km: 42000, price: 89900 });

    // When
    const found = sameVehicleAmong([known], infoOf('Porsche 911 Carrera S 2015 95 000 km 69 900 €'));

    // Then
    expect(found).toBeUndefined();
  });

  it('une nouvelle annonce Leboncoin sur une voiture qui a déjà une annonce Leboncoin est une republication', () => {
    // Given
    const listings = [
      knownListing({
        site: 'lacentrale',
        siteLabel: 'La Centrale',
        externalId: '69112345678',
        url: 'https://www.lacentrale.fr/auto-occasion-annonce-69112345678.html',
      }),
      knownListing({ id: 2, site: 'leboncoin', siteLabel: 'Leboncoin' }),
    ];

    // When
    const attachment = attachmentOf(listings, 'leboncoin');

    // Then
    expect(attachment).toBe('repost');
  });

  it('une annonce AutoScout24 sur une voiture connue seulement par Leboncoin est la même voiture vue sur un autre site', () => {
    // Given
    const listings = [knownListing({ site: 'leboncoin', siteLabel: 'Leboncoin' })];

    // When
    const attachment = attachmentOf(listings, 'autoscout24');

    // Then
    expect(attachment).toBe('otherSite');
  });
});
