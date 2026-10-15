import webpush from 'web-push';
import type { DeliveryFailed, NotificationChannel } from '../application/ports/notificationChannel.js';

export interface VapidKeys {
  readonly publicKey: string;
  readonly privateKey: string;
}

const PUSH_TIME_TO_LIVE_SECONDS = 3600;

const GONE_SUBSCRIPTION_STATUSES: readonly unknown[] = [404, 410];

const DEFAULT_VAPID_SUBJECT = 'https://autoveille.local';

const failed = (error: unknown): DeliveryFailed => ({ kind: 'failed', error: error instanceof Error ? error : new Error(String(error)) });

const isGoneSubscription = (error: unknown): boolean =>
  typeof error === 'object' && error !== null && 'statusCode' in error && GONE_SUBSCRIPTION_STATUSES.includes(error.statusCode);

const vapidSubject = (contactEmail: string): string => (contactEmail ? `mailto:${contactEmail}` : DEFAULT_VAPID_SUBJECT);

export const legacyNotificationChannel = (
  vapid: VapidKeys | undefined,
  contactEmail: string,
  fetchImpl: typeof fetch = fetch,
): NotificationChannel => {
  const vapidDetails =
    vapid === undefined
      ? {}
      : { vapidDetails: { subject: vapidSubject(contactEmail), publicKey: vapid.publicKey, privateKey: vapid.privateKey } };
  return {
    push: async (subscription, notification) => {
      const recipient = {
        endpoint: subscription.endpoint,
        keys: { p256dh: subscription.keys?.p256dh ?? '', auth: subscription.keys?.auth ?? '' },
      };
      try {
        await webpush.sendNotification(recipient, JSON.stringify(notification), { TTL: PUSH_TIME_TO_LIVE_SECONDS, ...vapidDetails });
        return { kind: 'delivered' };
      } catch (error) {
        return isGoneSubscription(error) ? { kind: 'subscriptionGone' } : failed(error);
      }
    },
    telegram: async (chat, text) => {
      try {
        const response = await fetchImpl(`https://api.telegram.org/bot${chat.botToken}/sendMessage`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ chat_id: chat.chatId, text, disable_web_page_preview: true }),
        });
        if (!response.ok) {
          return failed(new Error(`Telegram ${response.status}: ${await response.text().catch(() => '')}`));
        }
        return { kind: 'delivered' };
      } catch (error) {
        return failed(error);
      }
    },
  };
};
