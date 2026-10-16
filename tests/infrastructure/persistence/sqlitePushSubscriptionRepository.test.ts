import { describe, expect, it } from 'vitest';
import { SqlitePushSubscriptionRepository } from '../../../src/infrastructure/persistence/sqlite/sqlitePushSubscriptionRepository.js';
import { migratedLegacyDatabase } from '../../support/migratedLegacyDatabase.js';

const IPHONE_ENDPOINT = 'https://web.push.apple.com/GSY5AfoWqMCoUDT0Z3oDb4_q_-muM-b_P4qsEP8FTkGBO5xB2FLVwuAhsziYHdm1';

describe('abonnements push enregistrés dans SQLite', () => {
  it('le téléphone Android et l’iPhone abonnés avant la mise à jour restent notifiés, dans l’ordre de leur abonnement, avec leurs clés', () => {
    // Given
    const subscriptions = new SqlitePushSubscriptionRepository(migratedLegacyDatabase());

    // When
    const devices = subscriptions.all();

    // Then
    expect(devices.map((device) => [new URL(device.endpoint).host, device.keys?.auth, device.expirationTime])).toEqual([
      ['fcm.googleapis.com', '4pxYDRmg6Z4juZzzuQgqGA', null],
      ['web.push.apple.com', 'mHqLUlMgqtl3uRf_eafqhA', null],
    ]);
  });

  it('l’iPhone qui se réabonne après la mise à jour garde sa date d’abonnement d’origine, comme avant', () => {
    // Given
    const database = migratedLegacyDatabase();
    const subscriptions = new SqlitePushSubscriptionRepository(database);

    // When
    subscriptions.save(
      { endpoint: IPHONE_ENDPOINT, expirationTime: null, keys: { p256dh: 'BOr3nouvelleCleDuMemeIPhone', auth: 'Zm9vYmFyYmF6cXV4' } },
      '2026-10-16T09:12:00.000Z',
    );

    // Then
    expect(database.prepare('SELECT created_at FROM push_subscriptions WHERE endpoint = ?').get(IPHONE_ENDPOINT)).toEqual({
      created_at: '2026-09-20T18:22:47.016Z',
    });
    expect(subscriptions.all().map((device) => device.keys?.auth)).toEqual(['4pxYDRmg6Z4juZzzuQgqGA', 'Zm9vYmFyYmF6cXV4']);
  });
});
