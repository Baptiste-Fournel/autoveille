import type { EnteredTelegramChat } from '../../../application/notifications/sendTestTelegram.js';
import type { PushKeyResponse, SubscribeResponse, TelegramTestRequest } from '../../../shared/api.js';

export const pushKeyDto = (key: string | undefined): PushKeyResponse => ({ key });

export const subscribedDto = (count: number): SubscribeResponse => ({ ok: true, count });

export const enteredTelegramChatOf = (body: TelegramTestRequest): EnteredTelegramChat => ({ botToken: body.token, chatId: body.chatId });
