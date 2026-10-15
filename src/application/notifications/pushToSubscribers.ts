import type { DeliveryFailed, NotificationChannel, PushNotification } from '../ports/notificationChannel.js';
import type { PushSubscription, PushSubscriptionRepository } from '../ports/pushSubscriptionRepository.js';

export interface PushDependencies {
  readonly subscriptions: PushSubscriptionRepository;
  readonly channel: NotificationChannel;
}

export interface PushRoundCompleted {
  readonly kind: 'completed';
  readonly sent: number;
}

export type PushRound = PushRoundCompleted | DeliveryFailed;

const pushInTurn = async (
  dependencies: PushDependencies,
  remaining: readonly PushSubscription[],
  notification: PushNotification,
  sent: number,
): Promise<PushRound> => {
  const [subscription, ...others] = remaining;
  if (subscription === undefined) {
    return { kind: 'completed', sent };
  }
  const outcome = await dependencies.channel.push(subscription, notification);
  switch (outcome.kind) {
    case 'delivered':
      return pushInTurn(dependencies, others, notification, sent + 1);
    case 'subscriptionGone':
      dependencies.subscriptions.remove(subscription.endpoint);
      return pushInTurn(dependencies, others, notification, sent);
    case 'failed':
      return outcome;
  }
};

export const pushToSubscribers = (dependencies: PushDependencies, notification: PushNotification): Promise<PushRound> =>
  pushInTurn(dependencies, dependencies.subscriptions.all(), notification, 0);
