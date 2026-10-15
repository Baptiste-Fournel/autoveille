import { describe, expect, it } from 'vitest';
import { pushPublicKey, subscribe, unsubscribe } from '../../../src/application/notifications/subscriptions.js';
import type { PushSubscription } from '../../../src/application/ports/pushSubscriptionRepository.js';
import { fakeClock } from '../../fakes/fakeClock.js';
import { FAKE_PUSH_KEYS } from '../../fakes/fakePushKeyGenerator.js';
import { fakePushSubscriptionRepository } from '../../fakes/fakePushSubscriptionRepository.js';
import { fakeSecretStore } from '../../fakes/fakeSecretStore.js';

const PHONE: PushSubscription = {
  endpoint: 'https://fcm.googleapis.com/fcm/send/abonnement-de-test',
  expirationTime: null,
  keys: { p256dh: 'cle-p256dh-de-test', auth: 'secret-auth-de-test' },
};

const LAPTOP: PushSubscription = {
  endpoint: 'https://updates.push.services.mozilla.com/wpush/v2/abonnement-ordinateur',
  expirationTime: null,
  keys: { p256dh: 'cle-p256dh-ordinateur', auth: 'secret-auth-ordinateur' },
};

describe('abonnements aux notifications', () => {
  it('la clé publique des notifications est remise à l’application', () => {
    // Given
    const secrets = fakeSecretStore({ vapid_public: FAKE_PUSH_KEYS.publicKey, vapid_private: FAKE_PUSH_KEYS.privateKey });

    // When
    const key = pushPublicKey({ secrets });

    // Then
    expect(key).toBe(FAKE_PUSH_KEYS.publicKey);
  });

  it('le téléphone s’abonne aux notifications', () => {
    // Given
    const subscriptions = fakePushSubscriptionRepository();

    // When
    const count = subscribe({ subscriptions, clock: fakeClock() }, PHONE);

    // Then
    expect(count).toBe(1);
    expect(subscriptions.all()).toEqual([PHONE]);
  });

  it('le navigateur du téléphone qui renouvelle son abonnement ne le compte pas deux fois', () => {
    // Given
    const subscriptions = fakePushSubscriptionRepository();
    const clock = fakeClock();
    subscribe({ subscriptions, clock }, PHONE);
    subscribe({ subscriptions, clock }, LAPTOP);
    const renewed: PushSubscription = { ...PHONE, keys: { p256dh: 'nouvelle-cle-p256dh', auth: 'nouveau-secret-auth' } };

    // When
    const count = subscribe({ subscriptions, clock }, renewed);

    // Then
    expect(count).toBe(2);
    expect(subscriptions.all()).toEqual([renewed, LAPTOP]);
  });

  it('le téléphone se désabonne des notifications et l’ordinateur reste abonné', () => {
    // Given
    const subscriptions = fakePushSubscriptionRepository();
    const clock = fakeClock();
    subscribe({ subscriptions, clock }, PHONE);
    subscribe({ subscriptions, clock }, LAPTOP);

    // When
    unsubscribe({ subscriptions }, PHONE.endpoint);

    // Then
    expect(subscriptions.all()).toEqual([LAPTOP]);
  });
});
