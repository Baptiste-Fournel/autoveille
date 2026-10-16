import { describe, expect, it } from 'vitest';
import { sendTestPush, type TestPushDependencies } from '../../../src/application/notifications/sendTestPush.js';
import type { PushSubscription } from '../../../src/application/ports/pushSubscriptionRepository.js';
import { type FakeNotificationOptions, fakeNotificationChannel } from '../../fakes/fakeNotificationChannel.js';
import { fakePushSubscriptionRepository } from '../../fakes/fakePushSubscriptionRepository.js';
import { fakeSecretStore } from '../../fakes/fakeSecretStore.js';

const PUBLIC_ORIGIN = 'https://autoveille.example.fr';

const PHONE: PushSubscription = {
  endpoint: 'https://fcm.googleapis.com/fcm/send/abonnement-telephone',
  keys: { p256dh: 'cle-p256dh-telephone', auth: 'secret-auth-telephone' },
};

const OLD_PHONE: PushSubscription = {
  endpoint: 'https://fcm.googleapis.com/fcm/send/abonnement-ancien-telephone',
  keys: { p256dh: 'cle-p256dh-ancien-telephone', auth: 'secret-auth-ancien-telephone' },
};

const LAPTOP: PushSubscription = {
  endpoint: 'https://updates.push.services.mozilla.com/wpush/v2/abonnement-ordinateur',
  keys: { p256dh: 'cle-p256dh-ordinateur', auth: 'secret-auth-ordinateur' },
};

const pushTest = (subscribed: readonly PushSubscription[], channel: FakeNotificationOptions = {}) => {
  const subscriptions = fakePushSubscriptionRepository();
  for (const subscription of subscribed) {
    subscriptions.save(subscription, '2026-10-01T18:00:00.000Z');
  }
  const notifications = fakeNotificationChannel(channel);
  const dependencies: TestPushDependencies = {
    subscriptions,
    channel: notifications,
    secrets: fakeSecretStore({ base_url: PUBLIC_ORIGIN }),
    address: { configuredBaseUrl: '', port: 3000 },
  };
  return { dependencies, subscriptions, notifications };
};

describe('essai des notifications', () => {
  it('tester les notifications sans aucun appareil abonné', async () => {
    // Given
    const { dependencies, notifications } = pushTest([]);

    // When
    const result = await sendTestPush(dependencies);

    // Then
    expect(result).toEqual({ ok: false, detail: 'Aucun appareil abonné : activez les notifications sur ce téléphone ou cet ordinateur.' });
    expect(notifications.pushes()).toEqual([]);
  });

  it('l’essai envoie la notification au téléphone et à l’ordinateur abonnés, avec le lien de l’application', async () => {
    // Given
    const { dependencies, notifications } = pushTest([PHONE, LAPTOP]);

    // When
    const result = await sendTestPush(dependencies);

    // Then
    expect(result).toEqual({ ok: true, detail: 'Notification envoyée à 2 appareil(s).' });
    const notification = { title: 'AutoVeille', body: 'Les notifications fonctionnent sur cet appareil.', url: `${PUBLIC_ORIGIN}/` };
    expect(notifications.pushes()).toEqual([
      { endpoint: PHONE.endpoint, notification },
      { endpoint: LAPTOP.endpoint, notification },
    ]);
  });

  it('l’abonnement d’un ancien téléphone que le service push ne connaît plus est supprimé pendant l’essai, et seuls les autres comptent', async () => {
    // Given
    const { dependencies, subscriptions } = pushTest([OLD_PHONE, PHONE, LAPTOP], { goneEndpoints: [OLD_PHONE.endpoint] });

    // When
    const result = await sendTestPush(dependencies);

    // Then
    expect(result).toEqual({ ok: true, detail: 'Notification envoyée à 2 appareil(s).' });
    expect(subscriptions.all()).toEqual([PHONE, LAPTOP]);
  });

  it('quand le seul abonnement connu est celui d’un ancien téléphone, l’essai le supprime et dit qu’aucun appareil n’est abonné', async () => {
    // Given
    const { dependencies, subscriptions } = pushTest([OLD_PHONE], { goneEndpoints: [OLD_PHONE.endpoint] });

    // When
    const result = await sendTestPush(dependencies);

    // Then
    expect(result).toEqual({ ok: false, detail: 'Aucun appareil abonné : activez les notifications sur ce téléphone ou cet ordinateur.' });
    expect(subscriptions.all()).toEqual([]);
  });

  it('un service push qui refuse l’envoi arrête l’essai et en donne la raison', async () => {
    // Given
    const { dependencies, notifications, subscriptions } = pushTest([PHONE, LAPTOP], {
      failingEndpoints: { [PHONE.endpoint]: new Error('Received unexpected response code') },
    });

    // When
    const result = await sendTestPush(dependencies);

    // Then
    expect(result).toEqual({ ok: false, detail: 'Envoi impossible : Received unexpected response code' });
    expect(notifications.pushes()).toEqual([]);
    expect(subscriptions.all()).toEqual([PHONE, LAPTOP]);
  });
});
