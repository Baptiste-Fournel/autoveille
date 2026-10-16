import { describe, expect, it } from 'vitest';
import { sendTestTelegram } from '../../../src/application/notifications/sendTestTelegram.js';
import { defaultSettings } from '../../../src/domain/settings/defaults.js';
import type { Settings } from '../../../src/domain/settings/types.js';
import { fakeNotificationChannel } from '../../fakes/fakeNotificationChannel.js';
import { fakeSettingsRepository } from '../../fakes/fakeSettingsRepository.js';

const BOT_TOKEN = '7000000001:AAFakeBotTokenForTestsOnly';

const CHAT_ID = '512345678';

const OLD_BOT_TOKEN = '6000000001:AAOldFakeBotTokenForTestsOnly';

const OLD_CHAT_ID = '498765432';

const withTelegram = (telegramToken: string, telegramChatId: string): Settings => {
  const settings = defaultSettings();
  return { ...settings, notifications: { ...settings.notifications, telegramToken, telegramChatId } };
};

describe('essai des notifications', () => {
  it('tester Telegram sans jeton de bot ni conversation', async () => {
    // Given
    const channel = fakeNotificationChannel();

    // When
    const result = await sendTestTelegram({ settings: fakeSettingsRepository(), channel }, {});

    // Then
    expect(result).toEqual({ ok: false, detail: 'Renseignez le jeton du bot et l’identifiant de conversation.' });
    expect(channel.telegrams()).toEqual([]);
  });

  it('tester Telegram avec le jeton du bot tout juste créé, sans encore connaître l’identifiant de conversation', async () => {
    // Given
    const channel = fakeNotificationChannel();

    // When
    const result = await sendTestTelegram({ settings: fakeSettingsRepository(), channel }, { botToken: BOT_TOKEN, chatId: '' });

    // Then
    expect(result).toEqual({ ok: false, detail: 'Renseignez le jeton du bot et l’identifiant de conversation.' });
    expect(channel.telegrams()).toEqual([]);
  });

  it('un nouveau bot Telegram saisi dans le formulaire est essayé à la place de l’ancien, avant d’être enregistré', async () => {
    // Given
    const channel = fakeNotificationChannel();
    const settings = fakeSettingsRepository(withTelegram(OLD_BOT_TOKEN, OLD_CHAT_ID));

    // When
    const result = await sendTestTelegram({ settings, channel }, { botToken: BOT_TOKEN, chatId: CHAT_ID });

    // Then
    expect(result).toEqual({ ok: true, detail: 'Message envoyé sur Telegram.' });
    expect(channel.telegrams()).toEqual([
      { chat: { botToken: BOT_TOKEN, chatId: CHAT_ID }, text: 'AutoVeille : les notifications Telegram fonctionnent.' },
    ]);
    expect(settings.load().notifications).toMatchObject({ telegramToken: OLD_BOT_TOKEN, telegramChatId: OLD_CHAT_ID });
  });

  it('tester Telegram avec le formulaire vide utilise le bot et la conversation enregistrés', async () => {
    // Given
    const channel = fakeNotificationChannel();
    const settings = fakeSettingsRepository(withTelegram(BOT_TOKEN, CHAT_ID));

    // When
    const result = await sendTestTelegram({ settings, channel }, { botToken: '', chatId: '' });

    // Then
    expect(result).toEqual({ ok: true, detail: 'Message envoyé sur Telegram.' });
    expect(channel.telegrams()).toEqual([
      { chat: { botToken: BOT_TOKEN, chatId: CHAT_ID }, text: 'AutoVeille : les notifications Telegram fonctionnent.' },
    ]);
  });

  it('un bot dont le jeton a été révoqué : l’essai Telegram donne la réponse de Telegram', async () => {
    // Given
    const channel = fakeNotificationChannel({
      telegramFailure: new Error('Telegram 401: {"ok":false,"error_code":401,"description":"Unauthorized"}'),
    });
    const settings = fakeSettingsRepository(withTelegram(BOT_TOKEN, CHAT_ID));

    // When
    const result = await sendTestTelegram({ settings, channel }, {});

    // Then
    expect(result).toEqual({
      ok: false,
      detail: 'Envoi impossible : Telegram 401: {"ok":false,"error_code":401,"description":"Unauthorized"}',
    });
  });
});
