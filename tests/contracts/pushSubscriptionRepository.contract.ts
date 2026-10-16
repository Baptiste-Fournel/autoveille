import { expect, it } from 'vitest';
import type { PushSubscription, PushSubscriptionRepository } from '../../src/application/ports/pushSubscriptionRepository.js';

const ANDROID: PushSubscription = {
  endpoint: 'https://fcm.googleapis.com/fcm/send/dXk3bWZ0aW9uLmV4YW1wbGU',
  expirationTime: null,
  keys: {
    p256dh: 'BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QTpQtUbVlUls0VJXg7A8u-Ts1XbjhazAkj7I99e8QcYP7DkM',
    auth: 'tBHItJI5svbpez7KI4CCXg',
  },
};

const IPHONE: PushSubscription = {
  endpoint: 'https://web.push.apple.com/QGuQyavXutnMH8PvP1R3S8ozvqY',
  keys: {
    p256dh: 'BKj3zf2bnWGk7m3wqSh3ZbN5mD0XoJw1nF4n2wP6sV9tQe8rY5uI3oP1aS7dF0gH2jK4lZ6xC8vB0nM3qW5eR7t',
    auth: 'k8JV6sjdbhAi-n3d4oC1qg',
  },
};

export function pushSubscriptionRepositoryContract(create: () => PushSubscriptionRepository): void {
  it('le téléphone Android qui active les notifications rejoint les appareils à notifier', () => {
    // Given
    const subscriptions = create();

    // When
    subscriptions.save(ANDROID, '2026-10-13T10:05:00.000Z');

    // Then
    expect(subscriptions.all()).toEqual([ANDROID]);
  });

  it('les appareils sont notifiés dans l’ordre où ils se sont abonnés', () => {
    // Given
    const subscriptions = create();

    // When
    subscriptions.save(IPHONE, '2026-10-13T10:05:00.000Z');
    subscriptions.save(ANDROID, '2026-10-13T10:06:00.000Z');

    // Then
    expect(subscriptions.all()).toEqual([IPHONE, ANDROID]);
  });

  it('un iPhone qui se réabonne n’est compté qu’une fois, avec ses nouvelles clés, à sa place', () => {
    // Given
    const subscriptions = create();
    subscriptions.save(IPHONE, '2026-10-13T10:05:00.000Z');
    subscriptions.save(ANDROID, '2026-10-13T10:06:00.000Z');
    const renewed: PushSubscription = {
      ...IPHONE,
      keys: { p256dh: 'BOr3nouvelleClePubliqueDuMemeIPhone0000000000000000000000000000000000000000000000000', auth: 'Zm9vYmFyYmF6cXV4' },
    };

    // When
    subscriptions.save(renewed, '2026-10-14T08:00:00.000Z');

    // Then
    expect(subscriptions.all()).toEqual([renewed, ANDROID]);
  });

  it('un appareil désabonné, ou dont l’abonnement a expiré chez le service de push, n’est plus notifié', () => {
    // Given
    const subscriptions = create();
    subscriptions.save(IPHONE, '2026-10-13T10:05:00.000Z');
    subscriptions.save(ANDROID, '2026-10-13T10:06:00.000Z');

    // When
    subscriptions.remove(ANDROID.endpoint);

    // Then
    expect(subscriptions.all()).toEqual([IPHONE]);
  });
}
