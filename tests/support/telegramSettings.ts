import { defaultSettings } from '../../src/domain/settings/defaults.js';
import type { Settings } from '../../src/domain/settings/types.js';

export const GARAGE_BOT_TOKEN = '7312845521:AAF3kQ9vXbN2mZ7pLr4tYw8eJc1hUo6sDgI';

export const GARAGE_CHAT_ID = '518234907';

export const withGarageTelegram = (settings: Settings = defaultSettings(), push = true): Settings => ({
  ...settings,
  notifications: { push, telegramToken: GARAGE_BOT_TOKEN, telegramChatId: GARAGE_CHAT_ID },
});
