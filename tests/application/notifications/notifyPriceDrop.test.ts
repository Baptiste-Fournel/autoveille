import { describe, expect, it } from 'vitest';
import { notifyPriceDrop } from '../../../src/application/notifications/notifyPriceDrop.js';
import { DEALER_PHONE, ingestWorld } from '../../support/ingestWorld.js';
import { knownVehicle, LEBONCOIN_911_TITLE, leboncoinListing } from '../../support/knownVehicle.js';
import { GARAGE_BOT_TOKEN, GARAGE_CHAT_ID, withGarageTelegram } from '../../support/telegramSettings.js';

describe('notification d’une baisse de prix', () => {
  it('une baisse de prix sur une 911 contactée notifie « Prix baissé » avec « vendeur déjà contacté », sur le téléphone et sur Telegram', async () => {
    // Given
    const world = ingestWorld({ settings: withGarageTelegram() });
    const vehicle = knownVehicle({ status: 'contacte', price: 84900, priceDropped: true });

    // When
    await notifyPriceDrop(world.dependencies, {
      vehicle,
      listing: leboncoinListing(LEBONCOIN_911_TITLE, { price: 84900 }),
      from: 89900,
      to: 84900,
    });

    // Then
    expect(world.channel.pushes()).toEqual([
      {
        endpoint: DEALER_PHONE.endpoint,
        notification: {
          title: 'Prix baissé : Porsche 911 Carrera S',
          body: '89 900 € → 84 900 € • vendeur déjà contacté • Leboncoin',
          url: 'https://veille.garage-du-lac.fr/#/annonce/1',
          vehicleId: 1,
        },
      },
    ]);
    expect(world.channel.telegrams()).toEqual([
      {
        chat: { botToken: GARAGE_BOT_TOKEN, chatId: GARAGE_CHAT_ID },
        text: 'Prix baissé : Porsche 911 Carrera S\n89 900 € → 84 900 € • vendeur déjà contacté • Leboncoin\nhttps://veille.garage-du-lac.fr/#/annonce/1',
      },
    ]);
  });
});
