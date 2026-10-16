import { deliveryFailed, type NotificationChannel } from '../../application/ports/notificationChannel.js';

const TELEGRAM_API = 'https://api.telegram.org';

export const telegramChannel = (fetchImpl: typeof fetch): Pick<NotificationChannel, 'telegram'> => ({
  telegram: async (chat, text) => {
    try {
      const response = await fetchImpl(`${TELEGRAM_API}/bot${chat.botToken}/sendMessage`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ chat_id: chat.chatId, text, disable_web_page_preview: true }),
      });
      if (!response.ok) {
        return deliveryFailed(new Error(`Telegram ${response.status}: ${await response.text().catch(() => '')}`));
      }
      return { kind: 'delivered' };
    } catch (error) {
      return deliveryFailed(error);
    }
  },
});
