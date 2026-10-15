import type { PushSubscription } from './pushSubscriptionRepository.js';

export interface PushNotification {
  readonly title: string;
  readonly body: string;
  readonly url: string;
  readonly vehicleId?: number;
}

export interface TelegramChat {
  readonly botToken: string;
  readonly chatId: string;
}

export interface Delivered {
  readonly kind: 'delivered';
}

export interface SubscriptionGone {
  readonly kind: 'subscriptionGone';
}

export interface DeliveryFailed {
  readonly kind: 'failed';
  readonly error: Error;
}

export type PushOutcome = Delivered | SubscriptionGone | DeliveryFailed;

export type TelegramOutcome = Delivered | DeliveryFailed;

export interface NotificationChannel {
  push(subscription: PushSubscription, notification: PushNotification): Promise<PushOutcome>;
  telegram(chat: TelegramChat, text: string): Promise<TelegramOutcome>;
}
