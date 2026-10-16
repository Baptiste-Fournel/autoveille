import { describe, expect, it } from 'vitest';
import { previewTemplate } from '../../../src/application/settings/previewTemplate.js';
import { defaultSettings } from '../../../src/domain/settings/defaults.js';
import type { RawListing } from '../../../src/domain/vehicle/types.js';
import { garageDuLac } from '../../support/dealer.js';
import { ingest, ingestWorld } from '../../support/ingestWorld.js';

const PORSCHE_911_IN_MONTAUBAN: RawListing = {
  site: 'leboncoin',
  siteLabel: 'Leboncoin',
  externalId: '2811004242',
  url: 'https://www.leboncoin.fr/ad/voitures/2811004242',
  title: 'Porsche 911 Carrera 4S 3.0 450ch PDK',
  price: 109900,
  km: 38500,
  year: 2018,
  city: 'Montauban',
  postalCode: '82000',
  sellerType: 'particulier',
};

const SIGNED_TEMPLATE =
  'Bonjour, votre {modele} de {annee} à {prix}, vue à {ville}, m’intéresse. Je suis à {distance} km.\n\n{prenom} {nom}\n{concession}, {telephone}';

describe('aperçu d’un gabarit de message', () => {
  it('un gabarit des américaines saisi à l’écran est rendu sur la Mustang d’exemple d’Arcachon, à 12 km, signé du concessionnaire', () => {
    // Given
    const world = ingestWorld({ settings: { ...defaultSettings(), dealer: garageDuLac } });

    // When
    const preview = previewTemplate(world, { family: 'americaines', text: SIGNED_TEMPLATE });

    // Then
    expect(preview).toEqual({
      text: 'Bonjour, votre Ford Mustang GT de 2018 à 42 000 €, vue à Arcachon, m’intéresse. Je suis à 12 km.\n\nJean Dupont\nGarage du Lac, 06 12 34 56 78',
      warnings: ['noOptOutSentence'],
    });
  });

  it('sur une annonce reçue, l’aperçu reprend la voiture, sa ville et sa vraie distance plutôt que l’exemple', async () => {
    // Given
    const world = ingestWorld({ settings: { ...defaultSettings(), dealer: garageDuLac } });
    await ingest(world, PORSCHE_911_IN_MONTAUBAN);
    const vehicleId = world.vehicles.findListing(PORSCHE_911_IN_MONTAUBAN.site, PORSCHE_911_IN_MONTAUBAN.externalId)?.vehicle.id;

    // When
    const preview = previewTemplate(world, { text: SIGNED_TEMPLATE, vehicleId });

    // Then
    expect(preview.text).toBe(
      'Bonjour, votre Porsche 911 Carrera 4S de 2018 à 109 900 €, vue à Montauban, m’intéresse. Je suis à 179 km.\n\nJean Dupont\nGarage du Lac, 06 12 34 56 78',
    );
  });
});
