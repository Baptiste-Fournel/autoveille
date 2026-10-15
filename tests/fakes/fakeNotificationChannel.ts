import type { NotificationChannel, PushNotification, TelegramChat } from '../../src/application/ports/notificationChannel.js';

export interface SentPush {
  readonly endpoint: string;
  readonly notification: PushNotification;
}

export interface SentTelegram {
  readonly chat: TelegramChat;
  readonly text: string;
}

export interface FakeNotificationOptions {
  readonly goneEndpoints?: readonly string[];
  readonly failingEndpoints?: Readonly<Record<string, Error>>;
  readonly telegramFailure?: Error;
}

export interface FakeNotificationChannel extends NotificationChannel {
  readonly pushes: () => readonly SentPush[];
  readonly telegrams: () => readonly SentTelegram[];
}

export const fakeNotificationChannel = (options: FakeNotificationOptions = {}): FakeNotificationChannel => {
  let pushes: readonly SentPush[] = [];
  let telegrams: readonly SentTelegram[] = [];
  const failures = options.failingEndpoints ?? {};
  return {
    push: async (subscription, notification) => {
      const { endpoint } = subscription;
      if (options.goneEndpoints?.includes(endpoint)) {
        return { kind: 'subscriptionGone' };
      }
      const failure = Object.hasOwn(failures, endpoint) ? failures[endpoint] : undefined;
      if (failure !== undefined) {
        return { kind: 'failed', error: failure };
      }
      pushes = [...pushes, { endpoint, notification }];
      return { kind: 'delivered' };
    },
    telegram: async (chat, text) => {
      if (options.telegramFailure !== undefined) {
        return { kind: 'failed', error: options.telegramFailure };
      }
      telegrams = [...telegrams, { chat, text }];
      return { kind: 'delivered' };
    },
    pushes: () => pushes,
    telegrams: () => telegrams,
  };
};
