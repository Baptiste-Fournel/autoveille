import type { PushSubscriptionDto } from '../../../src/shared/api';

export const subscriptionDtoOf = (subscription: PushSubscriptionJSON): PushSubscriptionDto => {
  const p256dh = subscription.keys?.p256dh;
  const auth = subscription.keys?.auth;
  return {
    endpoint: subscription.endpoint ?? '',
    expirationTime: subscription.expirationTime ?? null,
    ...(p256dh !== undefined && auth !== undefined ? { keys: { p256dh, auth } } : {}),
  };
};
