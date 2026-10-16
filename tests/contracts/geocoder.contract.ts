import { expect, it } from 'vitest';
import type { Geocoder } from '../../src/application/ports/geocoder.js';

export function geocoderContract(create: () => Geocoder): void {
  it('Mérignac, la ville d’une annonce Leboncoin, est placée au centre de la commune', async () => {
    // Given
    const geocoder = create();

    // When
    const place = await geocoder.locate({ city: 'Mérignac', postalCode: '33700' });

    // Then
    expect(place).toEqual({ lat: 44.8386, lon: -0.6436, precision: 'city' });
  });

  it('un village de Gironde que le géocodage ne connaît pas, Saint-Laurent-Médoc 33112 : placé au centre du département', async () => {
    // Given
    const geocoder = create();

    // When
    const place = await geocoder.locate({ city: 'Saint-Laurent-Médoc', postalCode: '33112' });

    // Then
    expect(place).toEqual({ lat: 44.83, lon: -0.58, precision: 'department' });
  });

  it('une ville inconnue sans code postal, « Bordeaux-Lac » : introuvable', async () => {
    // Given
    const geocoder = create();

    // When
    const place = await geocoder.locate({ city: 'Bordeaux-Lac' });

    // Then
    expect(place).toBeUndefined();
  });

  it('une annonce sans ville ni code postal : introuvable', async () => {
    // Given
    const geocoder = create();

    // When
    const place = await geocoder.locate({});

    // Then
    expect(place).toBeUndefined();
  });
}
