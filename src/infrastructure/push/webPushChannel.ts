import type webpush from 'web-push';
import { deliveryFailed, type NotificationChannel } from '../../application/ports/notificationChannel.js';
import type { PushKeyPair } from '../../application/ports/pushKeyGenerator.js';

export interface WebPushClient {
  sendNotification(subscription: webpush.PushSubscription, payload: string, options: webpush.RequestOptions): Promise<unknown>;
}

const PUSH_TIME_TO_LIVE_SECONDS = 3600;

const GONE_SUBSCRIPTION_STATUSES: readonly unknown[] = [404, 410];

const VAPID_SUBJECT_WITHOUT_CONTACT = 'https://autoveille.local';

const isGoneSubscription = (error: unknown): boolean =>
  typeof error === 'object' && error !== null && 'statusCode' in error && GONE_SUBSCRIPTION_STATUSES.includes(error.statusCode);

const vapidSubject = (contactEmail: string): string => (contactEmail ? `mailto:${contactEmail}` : VAPID_SUBJECT_WITHOUT_CONTACT);

const signedWith = (keys: PushKeyPair | undefined, contactEmail: string): webpush.RequestOptions =>
  keys === undefined
    ? { TTL: PUSH_TIME_TO_LIVE_SECONDS }
    : {
        TTL: PUSH_TIME_TO_LIVE_SECONDS,
        vapidDetails: { subject: vapidSubject(contactEmail), publicKey: keys.publicKey, privateKey: keys.privateKey },
      };

export const webPushChannel = (
  keys: PushKeyPair | undefined,
  contactEmail: string,
  client: WebPushClient,
): Pick<NotificationChannel, 'push'> => {
  const options = signedWith(keys, contactEmail);
  return {
    push: async (subscription, notification) => {
      const recipient = {
        endpoint: subscription.endpoint,
        keys: { p256dh: subscription.keys?.p256dh ?? '', auth: subscription.keys?.auth ?? '' },
      };
      try {
        await client.sendNotification(recipient, JSON.stringify(notification), options);
        return { kind: 'delivered' };
      } catch (error) {
        return isGoneSubscription(error) ? { kind: 'subscriptionGone' } : deliveryFailed(error);
      }
    },
  };
};
