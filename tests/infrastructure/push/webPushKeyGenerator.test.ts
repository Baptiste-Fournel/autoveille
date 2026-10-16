import { describe, expect, it } from 'vitest';
import webpush from 'web-push';
import { webPushKeyGenerator } from '../../../src/infrastructure/push/webPushKeyGenerator.js';

describe('clés VAPID de l’application', () => {
  it('au premier démarrage, la paire de clés générée est acceptée par web-push pour signer un envoi vers le téléphone', () => {
    // Given
    const keys = webPushKeyGenerator.generateKeyPair();

    // When
    const headers = webpush.getVapidHeaders(
      'https://fcm.googleapis.com',
      'mailto:contact@garage-du-lac.fr',
      keys.publicKey,
      keys.privateKey,
      'aes128gcm',
    );

    // Then
    expect(keys.publicKey).toMatch(/^[A-Za-z0-9_-]{87}$/);
    expect(keys.privateKey).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(headers.Authorization).toContain(`k=${keys.publicKey}`);
  });
});
