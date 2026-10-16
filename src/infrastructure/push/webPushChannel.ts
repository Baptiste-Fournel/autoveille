import type webpush from 'web-push';
import { deliveryFailed, type NotificationChannel } from '../../application/ports/notificationChannel.js';
import type { PushKeyPair } from '../../application/ports/pushKeyGenerator.js';

export interface WebPushClient {
  sendNotification(subscription: webpush.PushSubscription, payload: string, options: webpush.RequestOptions): Promise<unknown>;
}

const PUSH_TIME_TO_LIVE_SECONDS = 3600;

const GONE_SUBSCRIPTION_STATUSES: readonly unknown[] = [404, 410];

const isGoneSubscription = (error: unknown): boolean =>
  typeof error === 'object' && error !== null && 'statusCode' in error && GONE_SUBSCRIPTION_STATUSES.includes(error.statusCode);

export type VapidSubject = () => string;

const signedWith = (keys: PushKeyPair | undefined, subject: VapidSubject): webpush.RequestOptions =>
  keys === undefined
    ? { TTL: PUSH_TIME_TO_LIVE_SECONDS }
    : {
        TTL: PUSH_TIME_TO_LIVE_SECONDS,
        vapidDetails: { subject: subject(), publicKey: keys.publicKey, privateKey: keys.privateKey },
      };

export const webPushChannel = (
  keys: PushKeyPair | undefined,
  subject: VapidSubject,
  client: WebPushClient,
): Pick<NotificationChannel, 'push'> => ({
  push: async (subscription, notification) => {
    const recipient = {
      endpoint: subscription.endpoint,
      keys: { p256dh: subscription.keys?.p256dh ?? '', auth: subscription.keys?.auth ?? '' },
    };
    try {
      await client.sendNotification(recipient, JSON.stringify(notification), signedWith(keys, subject));
      return { kind: 'delivered' };
    } catch (error) {
      return isGoneSubscription(error) ? { kind: 'subscriptionGone' } : deliveryFailed(error);
    }
  },
});
