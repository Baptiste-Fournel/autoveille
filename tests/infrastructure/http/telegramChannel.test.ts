import { describe, expect, it } from 'vitest';
import { telegramChannel } from '../../../src/infrastructure/http/telegramChannel.js';
import { answering, cutOffDuringBody, headerSent, simulatedWeb } from '../../support/simulatedWeb.js';
import { GARAGE_BOT_TOKEN, GARAGE_CHAT_ID } from '../../support/telegramSettings.js';

const SEND_MESSAGE = `https://api.telegram.org/bot${GARAGE_BOT_TOKEN}/sendMessage`;

const GARAGE_CHAT = { botToken: GARAGE_BOT_TOKEN, chatId: GARAGE_CHAT_ID };

const NEW_911 =
  'Nouvelle annonce : Porsche 911\n2019, 42 000 km, 98 500 € • Pessac, à 5 km • Leboncoin\nhttps://veille.example.com/#/annonce/12';

describe('envoi sur Telegram par le bot de la concession', () => {
  it('la 911 arrive dans la conversation de la concession : sendMessage reçoit le texte, sans aperçu du lien', async () => {
    // Given
    const web = simulatedWeb({ [SEND_MESSAGE]: answering('{"ok":true,"result":{"message_id":731}}') });

    // When
    const outcome = await telegramChannel(web.fetch).telegram(GARAGE_CHAT, NEW_911);

    // Then
    expect(outcome).toEqual({ kind: 'delivered' });
    const [request] = web.requests();
    expect(web.requested()).toEqual([SEND_MESSAGE]);
    expect(request?.init?.method).toBe('POST');
    expect(headerSent(request, 'content-type')).toBe('application/json');
    expect(request?.init?.body).toBe(JSON.stringify({ chat_id: GARAGE_CHAT_ID, text: NEW_911, disable_web_page_preview: true }));
  });

  it('le jeton du bot a été révoqué : Telegram répond 401 et l’erreur « Telegram 401: … » remonte avec la réponse', async () => {
    // Given
    const refusal = '{"ok":false,"error_code":401,"description":"Unauthorized"}';
    const web = simulatedWeb({ [SEND_MESSAGE]: answering(refusal, 401) });

    // When
    const outcome = await telegramChannel(web.fetch).telegram(GARAGE_CHAT, NEW_911);

    // Then
    expect(outcome.kind).toBe('failed');
    expect(outcome.kind === 'failed' ? outcome.error.message : undefined).toBe(`Telegram 401: ${refusal}`);
  });

  it('le jeton du bot a été révoqué et la connexion coupe pendant la réponse de Telegram : l’erreur « Telegram 401: » remonte sans la réponse', async () => {
    // Given
    const web = simulatedWeb({ [SEND_MESSAGE]: cutOffDuringBody('{"ok":false,"error_co', 401) });

    // When
    const outcome = await telegramChannel(web.fetch).telegram(GARAGE_CHAT, NEW_911);

    // Then
    expect(outcome.kind === 'failed' ? outcome.error.message : undefined).toBe('Telegram 401: ');
  });

  it('Telegram injoignable : l’erreur du réseau remonte telle quelle', async () => {
    // Given
    const web = simulatedWeb({});

    // When
    const outcome = await telegramChannel(web.fetch).telegram(GARAGE_CHAT, NEW_911);

    // Then
    expect(outcome.kind === 'failed' ? outcome.error : undefined).toEqual(new TypeError('fetch failed'));
  });
});
