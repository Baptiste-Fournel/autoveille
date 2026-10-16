export const TEST_PUSH_TITLE = 'AutoVeille';

export const TEST_PUSH_BODY = 'Les notifications fonctionnent sur cet appareil.';

export const NO_SUBSCRIBED_DEVICE = 'Aucun appareil abonné : activez les notifications sur ce téléphone ou cet ordinateur.';

export const testPushSentText = (devices: number): string => `Notification envoyée à ${devices} appareil(s).`;

export const partlySentText = (devices: number, failed: number, reason: string): string =>
  `Notification envoyée à ${devices} appareil(s) ; ${failed} appareil(s) en échec : ${reason}`;

export const TELEGRAM_CHAT_MISSING = 'Renseignez le jeton du bot et l’identifiant de conversation.';

export const TEST_TELEGRAM_TEXT = 'AutoVeille : les notifications Telegram fonctionnent.';

export const TEST_TELEGRAM_SENT = 'Message envoyé sur Telegram.';

export const sendingFailedText = (reason: string): string => `Envoi impossible : ${reason}`;
