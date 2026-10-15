import type { Clock } from '../ports/clock.js';
import type { PushSubscription, PushSubscriptionRepository } from '../ports/pushSubscriptionRepository.js';
import type { SecretStore } from '../ports/secretStore.js';

export interface PushKeyDependencies {
  readonly secrets: Pick<SecretStore, 'get'>;
}

export interface SubscribeDependencies {
  readonly subscriptions: PushSubscriptionRepository;
  readonly clock: Clock;
}

export interface UnsubscribeDependencies {
  readonly subscriptions: PushSubscriptionRepository;
}

export const pushPublicKey = ({ secrets }: PushKeyDependencies): string | undefined => secrets.get('vapid_public');

export const subscribe = ({ subscriptions, clock }: SubscribeDependencies, subscription: PushSubscription): number => {
  subscriptions.save(subscription, clock.now());
  return subscriptions.all().length;
};

export const unsubscribe = ({ subscriptions }: UnsubscribeDependencies, endpoint: string): void => {
  subscriptions.remove(endpoint);
};
