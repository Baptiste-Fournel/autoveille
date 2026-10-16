import { describe, expect, it } from 'vitest';
import {
  newVehicleNotification,
  priceDropNotification,
  truncatedDigestNotification,
} from '../../../src/application/notifications/content.js';
import { PUBLIC_ADDRESS } from '../../support/ingestWorld.js';
import { knownVehicle, LEBONCOIN_911_TITLE, leboncoinListing } from '../../support/knownVehicle.js';

const porsche911 = leboncoinListing(LEBONCOIN_911_TITLE);

describe('contenu des notifications', () => {
  it('la notification d’une 911 de Pessac donne son nom, son année, son kilométrage, son prix, sa ville et sa distance, et ouvre sa fiche', () => {
    // Given
    const vehicle = knownVehicle({ id: 12 });

    // When
    const messages = newVehicleNotification(vehicle, porsche911, PUBLIC_ADDRESS);

    // Then
    expect(messages).toEqual({
      push: {
        title: 'Nouvelle annonce : Porsche 911 Carrera S',
        body: '2015, 42 000 km, 89 900 € • Pessac, à 5 km • Leboncoin',
        url: 'https://veille.garage-du-lac.fr/#/annonce/12',
        vehicleId: 12,
      },
      telegram:
        'Nouvelle annonce : Porsche 911 Carrera S\n2015, 42 000 km, 89 900 € • Pessac, à 5 km • Leboncoin\nhttps://veille.garage-du-lac.fr/#/annonce/12',
    });
  });

  it('une 911 notifiée alors que la ville de la concession est introuvable : la notification donne la ville, sans distance', () => {
    // Given
    const vehicle = knownVehicle({ lat: null, lon: null, distanceKm: null });

    // When
    const messages = newVehicleNotification(vehicle, porsche911, PUBLIC_ADDRESS);

    // Then
    expect(messages.push.body).toBe('2015, 42 000 km, 89 900 € • Pessac • Leboncoin');
  });

  it('la baisse de prix d’une 911 déjà contactée : « Prix baissé », l’ancien et le nouveau prix, et « vendeur déjà contacté »', () => {
    // Given
    const vehicle = knownVehicle({ status: 'contacte', price: 84900, priceDropped: true });

    // When
    const messages = priceDropNotification(vehicle, { ...porsche911, price: 84900 }, 89900, 84900, PUBLIC_ADDRESS);

    // Then
    expect(messages.push).toEqual({
      title: 'Prix baissé : Porsche 911 Carrera S',
      body: '89 900 € → 84 900 € • vendeur déjà contacté • Leboncoin',
      url: 'https://veille.garage-du-lac.fr/#/annonce/1',
      vehicleId: 1,
    });
  });

  it('la notification d’un email La Centrale tronqué mène à l’écran Sites, et Telegram donne le lien vers la liste complète', () => {
    // Given
    const digest = {
      siteLabel: 'La Centrale',
      announced: 61,
      received: 3,
      moreUrl: 'https://www.lacentrale.fr/listing?makesModelsCommercialNames=PORSCHE&customerType=PART',
    };

    // When
    const messages = truncatedDigestNotification(digest, PUBLIC_ADDRESS);

    // Then
    expect(messages).toEqual({
      push: {
        title: 'La Centrale : 61 nouvelles annonces',
        body: '3 arrivées dans l’application, 58 autres sont à voir sur le site.',
        url: 'https://veille.garage-du-lac.fr/#/sources',
      },
      telegram:
        'La Centrale : 61 nouvelles annonces\n3 arrivées dans l’application, 58 autres sont à voir sur le site.\nhttps://www.lacentrale.fr/listing?makesModelsCommercialNames=PORSCHE&customerType=PART',
    });
  });
});
