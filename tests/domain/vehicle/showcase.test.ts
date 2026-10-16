import { describe, expect, it } from 'vitest';
import { vehicleShowcase } from '../../../src/domain/vehicle/showcase.js';
import { knownListing, knownVehicle } from '../../support/knownVehicle.js';

const MERCEDES_C63_PUBLISHED_AT = '2026-10-09T17:45:00.000Z';

const mercedesC63 = knownVehicle({ make: 'Mercedes-Benz', model: 'C63 S Coupé', publishedAt: MERCEDES_C63_PUBLISHED_AT });

const mercedesC63OnLaCentrale = knownListing({
  site: 'lacentrale',
  siteLabel: 'La Centrale',
  externalId: '69112345678',
  url: 'https://www.lacentrale.fr/auto-occasion-annonce-69112345678.html',
  title: 'Mercedes-AMG C63 S Coupé',
});

const mercedesC63OnLeboncoin = knownListing({
  id: 2,
  externalId: '2811004321',
  url: 'https://www.leboncoin.fr/ad/voitures/2811004321',
  title: 'Mercedes-AMG C63 S Coupé 510ch',
  imageUrl: 'https://img.leboncoin.fr/api/v1/lbcpb1/images/c6/3s/c63s-coupe.jpg',
  description: 'Mercedes-AMG C63 S Coupé, carnet Mercedes, échappement Performance, jamais tournée sur circuit.',
});

describe('ce que montre la carte d’une voiture', () => {
  it('une Mercedes-AMG C63 lue d’abord sur La Centrale sans photo, puis sur Leboncoin avec photo et texte, montre la photo et le texte de Leboncoin et garde sa date de mise en ligne', () => {
    // Given
    const listings = [mercedesC63OnLaCentrale, mercedesC63OnLeboncoin];

    // When
    const showcase = vehicleShowcase(mercedesC63, listings);

    // Then
    expect(showcase).toEqual({
      publishedAt: MERCEDES_C63_PUBLISHED_AT,
      imageUrl: mercedesC63OnLeboncoin.imageUrl,
      description: mercedesC63OnLeboncoin.description,
    });
  });

  it('une voiture enregistrée par la première version, avant que la voiture retienne sa date de mise en ligne, prend la plus ancienne date de ses annonces', () => {
    // Given
    const firstVersionMercedes = { ...mercedesC63, publishedAt: null };
    const listings = [
      { ...mercedesC63OnLaCentrale, publishedAt: '2026-09-18T08:00:00.000Z' },
      { ...mercedesC63OnLeboncoin, publishedAt: '2026-09-16T06:40:12.000Z' },
    ];

    // When
    const showcase = vehicleShowcase(firstVersionMercedes, listings);

    // Then
    expect(showcase.publishedAt).toBe('2026-09-16T06:40:12.000Z');
  });

  it('une voiture dont aucune annonce n’a transmis de photo ni de texte n’en montre pas', () => {
    // Given
    const listings = [mercedesC63OnLaCentrale];

    // When
    const showcase = vehicleShowcase(mercedesC63, listings);

    // Then
    expect({ imageUrl: showcase.imageUrl, description: showcase.description }).toEqual({ imageUrl: null, description: null });
  });
});
