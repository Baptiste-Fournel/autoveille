import type { PushSubscription } from '../../../application/ports/pushSubscriptionRepository.js';

export interface PushSubscriptionRow {
  readonly endpoint: string;
  readonly json: string;
  readonly created_at: string;
}

export const pushSubscriptionOf = (json: string): PushSubscription => {
  const subscription: PushSubscription = JSON.parse(json);
  return subscription;
};

export const pushSubscriptionRowOf = (subscription: PushSubscription, subscribedAt: string): PushSubscriptionRow => ({
  endpoint: subscription.endpoint,
  json: JSON.stringify(subscription),
  created_at: subscribedAt,
});
