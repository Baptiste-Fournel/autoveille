import { describe, expect, it } from 'vitest';
import { notifyNewVehicle } from '../../../src/application/notifications/notifyNewVehicle.js';
import { DEALER_PHONE, DEALER_TABLET, ingestWorld } from '../../support/ingestWorld.js';
import { knownVehicle, LEBONCOIN_911_TITLE, leboncoinListing } from '../../support/knownVehicle.js';
import { GARAGE_BOT_TOKEN, GARAGE_CHAT_ID, withGarageTelegram } from '../../support/telegramSettings.js';

const notice = { vehicle: knownVehicle(), listing: leboncoinListing(LEBONCOIN_911_TITLE) };

const NEW_911_TEXT =
  'Nouvelle annonce : Porsche 911 Carrera S\n2015, 42 000 km, 89 900 € • Pessac, à 5 km • Leboncoin\nhttps://veille.garage-du-lac.fr/#/annonce/1';

describe('notification d’une nouvelle annonce', () => {
  it('Telegram reçoit la 911 en plus du téléphone quand le bot de la concession est configuré', async () => {
    // Given
    const world = ingestWorld({ settings: withGarageTelegram() });

    // When
    await notifyNewVehicle(world.dependencies, notice);

    // Then
    expect(world.channel.pushes().map((sent) => sent.endpoint)).toEqual([DEALER_PHONE.endpoint]);
    expect(world.channel.telegrams()).toEqual([{ chat: { botToken: GARAGE_BOT_TOKEN, chatId: GARAGE_CHAT_ID }, text: NEW_911_TEXT }]);
  });

  it('les notifications push désactivées dans les réglages : seul Telegram reçoit la 911', async () => {
    // Given
    const world = ingestWorld({ settings: withGarageTelegram(undefined, false) });

    // When
    await notifyNewVehicle(world.dependencies, notice);

    // Then
    expect(world.channel.pushes()).toEqual([]);
    expect(world.channel.telegrams()).toHaveLength(1);
  });

  it('le téléphone désabonné entre-temps est retiré de la liste, et la tablette reçoit quand même la 911', async () => {
    // Given
    const world = ingestWorld({ devices: [DEALER_PHONE, DEALER_TABLET], channel: { goneEndpoints: [DEALER_PHONE.endpoint] } });

    // When
    await notifyNewVehicle(world.dependencies, notice);

    // Then
    expect(world.pushSubscriptions.all()).toEqual([DEALER_TABLET]);
    expect(world.channel.pushes().map((sent) => sent.endpoint)).toEqual([DEALER_TABLET.endpoint]);
  });

  it('le service push refuse l’envoi au téléphone (403) : la tablette reçoit quand même la 911, et le refus est rendu avec l’envoi', async () => {
    // Given
    const refused = new Error('Received unexpected response code');
    const world = ingestWorld({
      devices: [DEALER_PHONE, DEALER_TABLET],
      channel: { failingEndpoints: { [DEALER_PHONE.endpoint]: refused } },
    });

    // When
    const delivery = await notifyNewVehicle(world.dependencies, notice);

    // Then
    expect(delivery).toEqual({ delivered: 1, failures: [refused] });
    expect(world.channel.pushes().map((sent) => sent.endpoint)).toEqual([DEALER_TABLET.endpoint]);
    expect(world.pushSubscriptions.all()).toEqual([DEALER_PHONE, DEALER_TABLET]);
  });

  it('le service push refuse l’envoi à tous les appareils : rien n’est livré et l’erreur remonte', async () => {
    // Given
    const refused = new Error('Received unexpected response code');
    const world = ingestWorld({
      devices: [DEALER_PHONE, DEALER_TABLET],
      channel: { failingEndpoints: { [DEALER_PHONE.endpoint]: refused, [DEALER_TABLET.endpoint]: refused } },
    });

    // When
    const sending = notifyNewVehicle(world.dependencies, notice);

    // Then
    await expect(sending).rejects.toBe(refused);
    expect(world.channel.pushes()).toEqual([]);
  });

  it('le jeton du bot saisi mais pas encore l’identifiant de conversation : rien ne part sur Telegram, le téléphone reçoit la 911', async () => {
    // Given
    const world = ingestWorld({
      settings: { ...withGarageTelegram(), notifications: { push: true, telegramToken: GARAGE_BOT_TOKEN, telegramChatId: '' } },
    });

    // When
    await notifyNewVehicle(world.dependencies, notice);

    // Then
    expect(world.channel.telegrams()).toEqual([]);
    expect(world.channel.pushes()).toHaveLength(1);
  });
});
