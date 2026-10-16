import type Database from 'better-sqlite3';
import type { PushSubscription, PushSubscriptionRepository } from '../../../application/ports/pushSubscriptionRepository.js';
import { type PushSubscriptionRow, pushSubscriptionOf, pushSubscriptionRowOf } from './pushSubscriptionMapper.js';

export class SqlitePushSubscriptionRepository implements PushSubscriptionRepository {
  private readonly upsertSubscription: Database.Statement<[PushSubscriptionRow]>;
  private readonly deleteSubscription: Database.Statement<[string]>;
  private readonly selectSubscriptions: Database.Statement<[], Pick<PushSubscriptionRow, 'json'>>;

  constructor(database: Database.Database) {
    this.upsertSubscription = database.prepare<[PushSubscriptionRow]>(
      `INSERT INTO push_subscriptions (endpoint, json, created_at) VALUES (@endpoint, @json, @created_at)
       ON CONFLICT (endpoint) DO UPDATE SET json = excluded.json`,
    );
    this.deleteSubscription = database.prepare<[string]>('DELETE FROM push_subscriptions WHERE endpoint = ?');
    this.selectSubscriptions = database.prepare<[], Pick<PushSubscriptionRow, 'json'>>(
      'SELECT json FROM push_subscriptions ORDER BY rowid',
    );
  }

  save(subscription: PushSubscription, subscribedAt: string): void {
    this.upsertSubscription.run(pushSubscriptionRowOf(subscription, subscribedAt));
  }

  remove(endpoint: string): void {
    this.deleteSubscription.run(endpoint);
  }

  all(): readonly PushSubscription[] {
    return this.selectSubscriptions.all().map((row) => pushSubscriptionOf(row.json));
  }
}
