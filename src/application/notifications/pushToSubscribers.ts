import type { NotificationChannel, PushNotification } from '../ports/notificationChannel.js';
import type { PushSubscription, PushSubscriptionRepository } from '../ports/pushSubscriptionRepository.js';

export interface PushDependencies {
  readonly subscriptions: PushSubscriptionRepository;
  readonly channel: NotificationChannel;
}

export interface PushRound {
  readonly sent: number;
  readonly failures: readonly Error[];
}

const NOTHING_SENT: PushRound = { sent: 0, failures: [] };

const pushInTurn = async (
  dependencies: PushDependencies,
  remaining: readonly PushSubscription[],
  notification: PushNotification,
  round: PushRound,
): Promise<PushRound> => {
  const [subscription, ...others] = remaining;
  if (subscription === undefined) {
    return round;
  }
  const outcome = await dependencies.channel.push(subscription, notification);
  switch (outcome.kind) {
    case 'delivered':
      return pushInTurn(dependencies, others, notification, { ...round, sent: round.sent + 1 });
    case 'subscriptionGone':
      dependencies.subscriptions.remove(subscription.endpoint);
      return pushInTurn(dependencies, others, notification, round);
    case 'failed':
      return pushInTurn(dependencies, others, notification, { ...round, failures: [...round.failures, outcome.error] });
  }
};

export const pushToSubscribers = (dependencies: PushDependencies, notification: PushNotification): Promise<PushRound> =>
  pushInTurn(dependencies, dependencies.subscriptions.all(), notification, NOTHING_SENT);
