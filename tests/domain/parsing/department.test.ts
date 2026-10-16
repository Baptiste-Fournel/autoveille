import { describe, expect, it } from 'vitest';
import { parseDepartment } from '../../../src/domain/parsing/department.js';

describe('département lu à la fin du bloc d’une annonce', () => {
  it('« Vendeur particulier 33 » à la fin d’une annonce La Centrale la situe en Gironde (33)', () => {
    // Given
    const block = 'VOLKSWAGEN COCCINELLE Essence 2013 92 000 km 10 500 € Vendeur particulier 33';

    // When
    const department = parseDepartment(block);

    // Then
    expect(department).toEqual({ city: 'Gironde (33)', postalCode: '33' });
  });

  it('« Vendeur particulier ● 16 » suivi du bouton « Voir l’annonce » d’une baisse de prix La Centrale situe la voiture en Charente (16)', () => {
    // Given
    const block = 'MERCEDES VITO 2023 ● Automatique ● 130 000 km ● Diesel 35 000 € Vendeur particulier ● 16 Voir l’annonce';

    // When
    const department = parseDepartment(block);

    // Then
    expect(department).toEqual({ city: 'Charente (16)', postalCode: '16' });
  });
});
