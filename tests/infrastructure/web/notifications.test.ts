import { describe, expect, it } from 'vitest';
import { DEALER_PHONE } from '../../support/ingestWorld.js';
import { signedInApplication } from '../../support/signedInApplication.js';
import { simulatedPushService } from '../../support/simulatedPushService.js';
import { answering, simulatedWeb } from '../../support/simulatedWeb.js';
import { GARAGE_BOT_TOKEN, GARAGE_CHAT_ID } from '../../support/telegramSettings.js';

const NO_SUBSCRIBED_DEVICE = 'Aucun appareil abonné : activez les notifications sur ce téléphone ou cet ordinateur.';

const GARAGE_BOT_SEND_MESSAGE = `https://api.telegram.org/bot${GARAGE_BOT_TOKEN}/sendMessage`;

describe('abonnement du téléphone aux notifications', () => {
  it('la clé publique des notifications est remise à l’application connectée', async () => {
    // Given
    const { application, session } = await signedInApplication();

    // When
    const response = await application.server.inject({ method: 'GET', url: '/api/push/key', headers: session });

    // Then
    expect({ status: response.statusCode, body: response.json() }).toEqual({
      status: 200,
      body: { key: application.ports.secrets.get('vapid_public') },
    });
    expect(response.json().key).toMatch(/^[A-Za-z0-9_-]{87}$/);
  });

  it('le téléphone s’abonne aux notifications, puis l’essai lui parvient', async () => {
    // Given
    const pushService = simulatedPushService();
    const { application, session } = await signedInApplication({ webPush: pushService });
    const subscribed = await application.server.inject({
      method: 'POST',
      url: '/api/push/subscribe',
      headers: session,
      payload: { subscription: DEALER_PHONE },
    });

    // When
    const response = await application.server.inject({ method: 'POST', url: '/api/push/test', headers: session });

    // Then
    expect({ status: subscribed.statusCode, body: subscribed.json() }).toEqual({ status: 200, body: { ok: true, count: 1 } });
    expect(response.json()).toEqual({ ok: true, detail: 'Notification envoyée à 1 appareil(s).' });
    expect(pushService.deliveries().map((delivery) => delivery.endpoint)).toEqual([DEALER_PHONE.endpoint]);
  });

  it('un abonnement sans adresse d’envoi est refusé, et l’essai dit toujours qu’aucun appareil n’est abonné', async () => {
    // Given
    const { application, session } = await signedInApplication();
    const refused = await application.server.inject({
      method: 'POST',
      url: '/api/push/subscribe',
      headers: session,
      payload: { subscription: { keys: DEALER_PHONE.keys } },
    });

    // When
    const response = await application.server.inject({ method: 'POST', url: '/api/push/test', headers: session });

    // Then
    expect({ status: refused.statusCode, body: refused.json() }).toEqual({ status: 400, body: { error: 'Abonnement invalide.' } });
    expect(response.json()).toEqual({ ok: false, detail: NO_SUBSCRIBED_DEVICE });
  });

  it('le téléphone se désabonne : l’essai suivant dit qu’aucun appareil n’est abonné', async () => {
    // Given
    const pushService = simulatedPushService();
    const { application, session } = await signedInApplication({ webPush: pushService });
    await application.server.inject({
      method: 'POST',
      url: '/api/push/subscribe',
      headers: session,
      payload: { subscription: DEALER_PHONE },
    });
    const unsubscribed = await application.server.inject({
      method: 'POST',
      url: '/api/push/unsubscribe',
      headers: session,
      payload: { endpoint: DEALER_PHONE.endpoint },
    });

    // When
    const response = await application.server.inject({ method: 'POST', url: '/api/push/test', headers: session });

    // Then
    expect({ status: unsubscribed.statusCode, body: unsubscribed.json() }).toEqual({ status: 200, body: { ok: true } });
    expect(response.json()).toEqual({ ok: false, detail: NO_SUBSCRIBED_DEVICE });
    expect(pushService.deliveries()).toEqual([]);
  });

  it('juste après la mise en route, l’essai des notifications dit qu’aucun appareil n’est abonné', async () => {
    // Given
    const { application, session } = await signedInApplication();

    // When
    const response = await application.server.inject({ method: 'POST', url: '/api/push/test', headers: session });

    // Then
    expect({ status: response.statusCode, body: response.json() }).toEqual({
      status: 200,
      body: { ok: false, detail: NO_SUBSCRIBED_DEVICE },
    });
  });
});

describe('essai de Telegram', () => {
  it('l’essai Telegram avec le jeton du bot et la conversation saisis envoie le message par le bot de la concession', async () => {
    // Given
    const telegram = simulatedWeb({ [GARAGE_BOT_SEND_MESSAGE]: answering('{"ok":true}') });
    const { application, session } = await signedInApplication({ fetch: telegram.fetch });

    // When
    const response = await application.server.inject({
      method: 'POST',
      url: '/api/telegram/test',
      headers: session,
      payload: { token: GARAGE_BOT_TOKEN, chatId: GARAGE_CHAT_ID },
    });

    // Then
    expect({ status: response.statusCode, body: response.json() }).toEqual({
      status: 200,
      body: { ok: true, detail: 'Message envoyé sur Telegram.' },
    });
    expect(JSON.parse(String(telegram.requests()[0]?.init?.body))).toEqual({
      chat_id: GARAGE_CHAT_ID,
      text: 'AutoVeille : les notifications Telegram fonctionnent.',
      disable_web_page_preview: true,
    });
  });

  it('le bot Telegram de la concession a été révoqué : l’essai dit pourquoi l’envoi est impossible', async () => {
    // Given
    const revoked = '{"ok":false,"error_code":401,"description":"Unauthorized"}';
    const telegram = simulatedWeb({ [GARAGE_BOT_SEND_MESSAGE]: answering(revoked, 401) });
    const { application, session } = await signedInApplication({ fetch: telegram.fetch });

    // When
    const response = await application.server.inject({
      method: 'POST',
      url: '/api/telegram/test',
      headers: session,
      payload: { token: GARAGE_BOT_TOKEN, chatId: GARAGE_CHAT_ID },
    });

    // Then
    expect(response.json()).toEqual({ ok: false, detail: `Envoi impossible : Telegram 401: ${revoked}` });
  });
});
