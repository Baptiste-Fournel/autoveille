import { describe, expect, it } from 'vitest';
import { ingestListing } from '../../../src/application/ingest/ingestListing.js';
import type { RawListing } from '../../../src/domain/vehicle/types.js';
import { signedInApplication } from '../../support/signedInApplication.js';

const PORSCHE_911_RECEIVED: RawListing = {
  site: 'leboncoin',
  siteLabel: 'Leboncoin',
  externalId: '2811001234',
  url: 'https://www.leboncoin.fr/ad/voitures/2811001234',
  title: 'Porsche 911 Carrera 4S 3.0 450ch PDK',
  price: 112900,
  km: 42000,
  year: 2017,
  city: 'Mérignac',
  postalCode: '33700',
  sellerType: 'particulier',
};

const GERMAN_TEMPLATE_ON = (vehicle: string, year: number, km: string): string => `Bonjour,

Je viens de tomber sur votre ${vehicle} ${year} sur Leboncoin. Une ${vehicle} avec ${km} km, c'est le genre de voiture qu'on nous demande régulièrement.

Si la vente traîne ou si vous en avez assez des gens qui viennent pour négocier à moitié prix, on peut en parler. Soit je vous fais une proposition de reprise ferme, soit on la met en dépôt chez nous, exposée en showroom, et vous êtes payé à la vente. Dans les deux cas vous ne vous occupez plus de rien.

Si ça ne vous intéresse pas, pas de souci, je ne reviendrai pas vers vous.`;

describe('écran Messages : aperçu d’un gabarit', () => {
  it('l’aperçu par défaut montre le premier gabarit des allemandes sur une Porsche d’exemple', async () => {
    // Given
    const { application, session } = await signedInApplication();

    // When
    const response = await application.server.inject({ method: 'POST', url: '/api/templates/preview', headers: session, payload: {} });

    // Then
    expect({ status: response.statusCode, body: response.json() }).toEqual({
      status: 200,
      body: { text: GERMAN_TEMPLATE_ON('Porsche 911 Carrera S', 2015, '42 000'), warnings: [] },
    });
  });

  it('l’aperçu d’un texte saisi pour les italiennes signale le tiret long et retire la phrase au téléphone vide', async () => {
    // Given
    const { application, session } = await signedInApplication();

    // When
    const response = await application.server.inject({
      method: 'POST',
      url: '/api/templates/preview',
      headers: session,
      payload: {
        family: 'italiennes',
        text: 'Bonjour, votre {modele} de {annee} m’intéresse — je suis à {distance} km de chez vous. Appelez-moi au {telephone}, je n’insisterai pas.',
      },
    });

    // Then
    expect({ status: response.statusCode, body: response.json() }).toEqual({
      status: 200,
      body: {
        text: 'Bonjour, votre Ferrari 360 Modena F1 de 2001 m’intéresse — je suis à 12 km de chez vous.',
        warnings: ['Contient un tiret long (— ou –) : à remplacer par une virgule ou un point.'],
      },
    });
  });

  it('l’aperçu du gabarit sur une annonce reçue reprend la Porsche reçue', async () => {
    // Given
    const { application, session } = await signedInApplication();
    const { ports } = application;
    await ingestListing(ports, { listing: PORSCHE_911_RECEIVED, settings: ports.settings.load(), notify: false, aboutOlderAds: false });
    const vehicleId = ports.vehicles.findListing(PORSCHE_911_RECEIVED.site, PORSCHE_911_RECEIVED.externalId)?.vehicle.id;

    // When
    const response = await application.server.inject({
      method: 'POST',
      url: '/api/templates/preview',
      headers: session,
      payload: { vehicleId },
    });

    // Then
    expect({ status: response.statusCode, body: response.json() }).toEqual({
      status: 200,
      body: { text: GERMAN_TEMPLATE_ON('Porsche 911 Carrera 4S', 2017, '42 000'), warnings: [] },
    });
  });
});
