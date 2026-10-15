import type { PushSubscription, PushSubscriptionRepository } from '../../src/application/ports/pushSubscriptionRepository.js';
import type { TransactionParticipant } from './fakeTransaction.js';

export type FakePushSubscriptionRepository = PushSubscriptionRepository & TransactionParticipant;

export const fakePushSubscriptionRepository = (): FakePushSubscriptionRepository => {
  let subscriptions: readonly PushSubscription[] = [];
  return {
    save: (subscription) => {
      const known = subscriptions.some((existing) => existing.endpoint === subscription.endpoint);
      subscriptions = known
        ? subscriptions.map((existing) => (existing.endpoint === subscription.endpoint ? subscription : existing))
        : [...subscriptions, subscription];
    },
    remove: (endpoint) => {
      subscriptions = subscriptions.filter((subscription) => subscription.endpoint !== endpoint);
    },
    all: () => subscriptions,
    snapshot: () => {
      const kept = subscriptions;
      return () => {
        subscriptions = kept;
      };
    },
  };
};
