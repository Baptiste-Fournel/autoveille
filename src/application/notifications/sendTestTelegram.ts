import {
  sendingFailedText,
  TELEGRAM_CHAT_MISSING,
  TEST_TELEGRAM_SENT,
  TEST_TELEGRAM_TEXT,
} from '../../domain/presentation/notificationTests.js';
import type { NotificationChannel } from '../ports/notificationChannel.js';
import type { SettingsRepository } from '../ports/settingsRepository.js';
import type { TestSendResult } from './testSendResult.js';

export interface TestTelegramDependencies {
  readonly settings: SettingsRepository;
  readonly channel: NotificationChannel;
}

export interface EnteredTelegramChat {
  readonly botToken?: string;
  readonly chatId?: string;
}

export const sendTestTelegram = async (
  { settings, channel }: TestTelegramDependencies,
  entered: EnteredTelegramChat,
): Promise<TestSendResult> => {
  const saved = settings.load().notifications;
  const botToken = entered.botToken || saved.telegramToken;
  const chatId = entered.chatId || saved.telegramChatId;
  if (!botToken || !chatId) {
    return { ok: false, detail: TELEGRAM_CHAT_MISSING };
  }
  const outcome = await channel.telegram({ botToken, chatId }, TEST_TELEGRAM_TEXT);
  return outcome.kind === 'delivered'
    ? { ok: true, detail: TEST_TELEGRAM_SENT }
    : { ok: false, detail: sendingFailedText(outcome.error.message) };
};
