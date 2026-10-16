import { describe, expect, it } from 'vitest';
import webpush from 'web-push';
import { pushToSubscribers } from '../../../src/application/notifications/pushToSubscribers.js';
import type { PushNotification } from '../../../src/application/ports/notificationChannel.js';
import { vapidSubject } from '../../../src/infrastructure/push/vapidSubject.js';
import { type WebPushClient, webPushChannel } from '../../../src/infrastructure/push/webPushChannel.js';
import { fakeNotificationChannel } from '../../fakes/fakeNotificationChannel.js';
import { FAKE_PUSH_KEYS } from '../../fakes/fakePushKeyGenerator.js';
import { fakePushSubscriptionRepository } from '../../fakes/fakePushSubscriptionRepository.js';
import { DEALER_PHONE, DEALER_TABLET } from '../../support/ingestWorld.js';

interface PushServiceCall {
  readonly subscription: webpush.PushSubscription;
  readonly payload: string;
  readonly options: webpush.RequestOptions;
}

interface SimulatedPushService extends WebPushClient {
  readonly calls: () => readonly PushServiceCall[];
}

const pushServiceAnswering = (refusals: Readonly<Record<string, unknown>> = {}): SimulatedPushService => {
  let calls: readonly PushServiceCall[] = [];
  return {
    sendNotification: async (subscription, payload, options) => {
      calls = [...calls, { subscription, payload, options }];
      if (Object.hasOwn(refusals, subscription.endpoint)) {
        throw refusals[subscription.endpoint];
      }
      return { statusCode: 201, body: '', headers: {} };
    },
    calls: () => calls,
  };
};

const refusedWith = (statusCode: number, body: string, endpoint: string): webpush.WebPushError =>
  new webpush.WebPushError('Received unexpected response code', statusCode, {}, body, endpoint);

const GARAGE_CONTACT = (): string => vapidSubject('contact@garage-du-lac.fr', 'https://veille.garage-du-lac.fr');

const NO_CONTACT = (): string => vapidSubject('', 'https://veille.garage-du-lac.fr');

const NEW_911: PushNotification = {
  title: 'Nouvelle annonce : Porsche 911',
  body: '2019, 42 000 km, 98 500 € • Pessac, à 5 km • Leboncoin',
  url: 'https://veille.garage-du-lac.fr/#/annonce/12',
  vehicleId: 12,
};

describe('envoi des notifications push par web-push', () => {
  it('le téléphone du concessionnaire reçoit la 911, signée avec les clés VAPID de l’application et valable une heure', async () => {
    // Given
    const pushService = pushServiceAnswering();

    // When
    const outcome = await webPushChannel(FAKE_PUSH_KEYS, GARAGE_CONTACT, pushService).push(DEALER_PHONE, NEW_911);

    // Then
    expect(outcome).toEqual({ kind: 'delivered' });
    expect(pushService.calls()).toEqual([
      {
        subscription: { endpoint: DEALER_PHONE.endpoint, keys: DEALER_PHONE.keys },
        payload: JSON.stringify(NEW_911),
        options: {
          TTL: 3600,
          vapidDetails: {
            subject: 'mailto:contact@garage-du-lac.fr',
            publicKey: FAKE_PUSH_KEYS.publicKey,
            privateKey: FAKE_PUSH_KEYS.privateKey,
          },
        },
      },
    ]);
  });

  it('sans adresse de contact (CONTACT_EMAIL vide), l’envoi est signé au nom de l’adresse publique de l’application, qu’Apple accepte là où il refusait https://autoveille.local (403 BadJwtToken)', async () => {
    // Given
    const pushService = pushServiceAnswering();

    // When
    await webPushChannel(FAKE_PUSH_KEYS, NO_CONTACT, pushService).push(DEALER_TABLET, NEW_911);

    // Then
    expect(pushService.calls()[0]?.options.vapidDetails?.subject).toBe('https://veille.garage-du-lac.fr');
  });

  it('le téléphone s’est désabonné : le service push répond 410, l’abonnement est déclaré disparu', async () => {
    // Given
    const pushService = pushServiceAnswering({
      [DEALER_PHONE.endpoint]: refusedWith(410, 'push subscription has unsubscribed or expired.\n', DEALER_PHONE.endpoint),
    });

    // When
    const outcome = await webPushChannel(FAKE_PUSH_KEYS, NO_CONTACT, pushService).push(DEALER_PHONE, NEW_911);

    // Then
    expect(outcome).toEqual({ kind: 'subscriptionGone' });
  });

  it('l’abonnement de la tablette a expiré chez Apple : le service push répond 404, l’abonnement est déclaré disparu', async () => {
    // Given
    const pushService = pushServiceAnswering({
      [DEALER_TABLET.endpoint]: refusedWith(404, '{"reason":"ExpiredSubscription"}', DEALER_TABLET.endpoint),
    });

    // When
    const outcome = await webPushChannel(FAKE_PUSH_KEYS, NO_CONTACT, pushService).push(DEALER_TABLET, NEW_911);

    // Then
    expect(outcome).toEqual({ kind: 'subscriptionGone' });
  });

  it('le service push refuse la signature (403) : l’erreur de web-push remonte telle quelle', async () => {
    // Given
    const refusal = refusedWith(403, '{"reason":"BadJwtToken"}', DEALER_TABLET.endpoint);
    const pushService = pushServiceAnswering({ [DEALER_TABLET.endpoint]: refusal });

    // When
    const outcome = await webPushChannel(FAKE_PUSH_KEYS, NO_CONTACT, pushService).push(DEALER_TABLET, NEW_911);

    // Then
    expect(outcome).toEqual({ kind: 'failed', error: refusal });
  });

  it('la notification d’une 911 : l’abonnement du téléphone disparu (410) est retiré de la liste, et la tablette la reçoit', async () => {
    // Given
    const subscriptions = fakePushSubscriptionRepository();
    subscriptions.save(DEALER_PHONE, '2026-09-14T16:05:30.402Z');
    subscriptions.save(DEALER_TABLET, '2026-09-20T18:22:47.016Z');
    const pushService = pushServiceAnswering({
      [DEALER_PHONE.endpoint]: refusedWith(410, 'push subscription has unsubscribed or expired.\n', DEALER_PHONE.endpoint),
    });
    const channel = { ...fakeNotificationChannel(), ...webPushChannel(FAKE_PUSH_KEYS, NO_CONTACT, pushService) };

    // When
    const round = await pushToSubscribers({ subscriptions, channel }, NEW_911);

    // Then
    expect(round).toEqual({ sent: 1, failures: [] });
    expect(subscriptions.all().map((subscription) => subscription.endpoint)).toEqual([DEALER_TABLET.endpoint]);
    expect(pushService.calls().map((call) => call.subscription.endpoint)).toEqual([DEALER_PHONE.endpoint, DEALER_TABLET.endpoint]);
  });

  it('un abonnement enregistré sans ses clés : web-push refuse l’envoi avant tout appel réseau, et son erreur remonte', async () => {
    // Given
    const withoutKeys = { endpoint: DEALER_PHONE.endpoint };

    // When
    const outcome = await webPushChannel(FAKE_PUSH_KEYS, NO_CONTACT, webpush).push(withoutKeys, NEW_911);

    // Then
    expect(outcome.kind === 'failed' ? outcome.error.message : undefined).toBe(
      "To send a message with a payload, the subscription must have 'auth' and 'p256dh' keys.",
    );
  });
});
