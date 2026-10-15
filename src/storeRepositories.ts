import { timingSafeEqual } from 'node:crypto';
import type { EmailReadingSummary, MailboxStateRepository, ProcessedEmail } from './application/ports/mailboxStateRepository.js';
import type { PushSubscription, PushSubscriptionRepository } from './application/ports/pushSubscriptionRepository.js';
import type { SecretStore } from './application/ports/secretStore.js';
import type { SettingsRepository } from './application/ports/settingsRepository.js';
import type { SourceId, SourceRunRepository } from './application/ports/sourceRunRepository.js';
import type { Transaction } from './application/ports/transaction.js';
import type { VehicleRepository } from './application/ports/vehicleRepository.js';
import type { EmailRow, Store } from './db.js';
import { storeVehicleRepository } from './storeVehicleRepository.js';

export interface StoreRepositories {
  readonly vehicles: VehicleRepository;
  readonly settings: SettingsRepository;
  readonly mailboxState: MailboxStateRepository;
  readonly subscriptions: PushSubscriptionRepository;
  readonly secrets: SecretStore;
  readonly sourceRuns: SourceRunRepository;
  readonly transaction: Transaction;
}

const summaryOf = (stored: string | null): EmailReadingSummary | null => {
  if (!stored) {
    return null;
  }
  const summary: EmailReadingSummary = JSON.parse(stored);
  return summary;
};

const processedEmailOf = (row: EmailRow): ProcessedEmail => ({
  messageId: row.message_id,
  uid: row.uid,
  subject: row.subject,
  sender: row.sender,
  receivedAt: row.received_at,
  site: row.site,
  listingCount: row.parsed_count,
  summary: summaryOf(row.parsed_json),
  error: row.error,
  processedAt: row.processed_at,
});

const isSourceId = (source: string): source is SourceId => source === 'email' || source.startsWith('http:');

const subscriptionOf = (stored: string): PushSubscription => {
  const subscription: PushSubscription = JSON.parse(stored);
  return subscription;
};

const sameSecret = (expected: string | undefined, candidate: string): boolean => {
  if (!expected || !candidate) {
    return false;
  }
  const expectedBytes = Buffer.from(expected);
  const candidateBytes = Buffer.from(candidate);
  return candidateBytes.length === expectedBytes.length && timingSafeEqual(candidateBytes, expectedBytes);
};

const storeMailboxState = (store: Store): MailboxStateRepository => ({
  isProcessed: (messageId) => store.emailProcessed(messageId),
  recordProcessed: (email) =>
    store.markEmail(
      {
        message_id: email.messageId,
        uid: email.uid,
        subject: email.subject,
        sender: email.sender,
        received_at: email.receivedAt,
        site: email.site,
        parsed_count: email.listingCount,
        parsed_json: email.summary === null ? null : JSON.stringify(email.summary),
        error: email.error,
      },
      email.processedAt,
    ),
  recentlyProcessed: (limit) => store.processedEmails(limit).map(processedEmailOf),
  position: (mailbox) => {
    const state = store.mailState(mailbox);
    return { lastUid: state.last_uid, uidValidity: state.uid_validity };
  },
  savePosition: (mailbox, position) => store.saveMailState(mailbox, position.lastUid, position.uidValidity),
  forgetReadEmails: () => store.resetMailbox(),
});

export const storeRepositories = (store: Store): StoreRepositories => ({
  vehicles: storeVehicleRepository(store),
  settings: { load: () => store.getSettings(), save: (settings) => store.saveSettings(settings) },
  mailboxState: storeMailboxState(store),
  subscriptions: {
    save: (subscription, subscribedAt) => store.addPushSubscription(subscription, subscribedAt),
    remove: (endpoint) => store.removePushSubscription(endpoint),
    all: () => store.pushSubscriptions().map((stored) => subscriptionOf(stored.json)),
  },
  secrets: {
    get: (key) => store.secret(key),
    set: (key, value) => store.setSecret(key, value),
    matches: (key, candidate) => sameSecret(store.secret(key), candidate),
  },
  sourceRuns: {
    record: (run) => store.sourceRun(run.source, run.ok, run.detail, run.lastRunAt),
    all: () =>
      store
        .sourceRuns()
        .flatMap((run) =>
          isSourceId(run.source) && run.last_run_at !== null
            ? [{ source: run.source, lastRunAt: run.last_run_at, ok: Boolean(run.ok), detail: run.detail ?? '' }]
            : [],
        ),
  },
  transaction: { run: (work) => store.transaction(work) },
});
