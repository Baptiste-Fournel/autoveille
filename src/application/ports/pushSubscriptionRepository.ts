export interface PushSubscriptionKeys {
  readonly p256dh: string;
  readonly auth: string;
}

export interface PushSubscription {
  readonly endpoint: string;
  readonly expirationTime?: number | null;
  readonly keys?: PushSubscriptionKeys;
}

export interface PushSubscriptionRepository {
  save(subscription: PushSubscription, subscribedAt: string): void;
  remove(endpoint: string): void;
  all(): readonly PushSubscription[];
}
