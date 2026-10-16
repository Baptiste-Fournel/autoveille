import type { NotificationChannel } from '../ports/notificationChannel.js';
import type { PushSubscriptionRepository } from '../ports/pushSubscriptionRepository.js';
import type { SecretStore } from '../ports/secretStore.js';
import type { SettingsRepository } from '../ports/settingsRepository.js';
import type { NotificationMessages } from './content.js';
import type { PublicAddressSettings } from './publicAddress.js';
import { pushToSubscribers } from './pushToSubscribers.js';
import { storedPushKeys } from './storedPushKeys.js';

export interface NotificationDependencies {
  readonly settings: SettingsRepository;
  readonly secrets: SecretStore;
  readonly subscriptions: PushSubscriptionRepository;
  readonly channel: NotificationChannel;
  readonly address: PublicAddressSettings;
}

export interface Delivery {
  readonly delivered: number;
  readonly failures: readonly Error[];
}

export async function sendToChannels(dependencies: NotificationDependencies, messages: NotificationMessages): Promise<Delivery> {
  const { notifications } = dependencies.settings.load();
  const [pushed, telegram] = await Promise.all([
    notifications.push && storedPushKeys(dependencies.secrets) !== undefined ? pushToSubscribers(dependencies, messages.push) : undefined,
    notifications.telegramToken && notifications.telegramChatId
      ? dependencies.channel.telegram({ botToken: notifications.telegramToken, chatId: notifications.telegramChatId }, messages.telegram)
      : undefined,
  ]);
  const delivery: Delivery = {
    delivered: (pushed?.sent ?? 0) + (telegram?.kind === 'delivered' ? 1 : 0),
    failures: [...(pushed?.failures ?? []), ...(telegram?.kind === 'failed' ? [telegram.error] : [])],
  };
  const [firstFailure] = delivery.failures;
  if (delivery.delivered === 0 && firstFailure !== undefined) {
    throw firstFailure;
  }
  return delivery;
}
