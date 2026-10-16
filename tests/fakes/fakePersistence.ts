import type { Transaction } from '../../src/application/ports/transaction.js';
import { type FakeMailboxStateRepository, fakeMailboxStateRepository } from './fakeMailboxStateRepository.js';
import { type FakePushSubscriptionRepository, fakePushSubscriptionRepository } from './fakePushSubscriptionRepository.js';
import { type FakeSecretStore, fakeSecretStore } from './fakeSecretStore.js';
import { type FakeSessionRepository, fakeSessionRepository } from './fakeSessionRepository.js';
import { type FakeSettingsRepository, fakeSettingsRepository } from './fakeSettingsRepository.js';
import { type FakeSourceRunRepository, fakeSourceRunRepository } from './fakeSourceRunRepository.js';
import { fakeTransaction } from './fakeTransaction.js';
import { type FakeVehicleRepository, fakeVehicleRepository } from './fakeVehicleRepository.js';

export interface FakePersistence {
  readonly vehicles: FakeVehicleRepository;
  readonly settings: FakeSettingsRepository;
  readonly mailboxState: FakeMailboxStateRepository;
  readonly pushSubscriptions: FakePushSubscriptionRepository;
  readonly sessions: FakeSessionRepository;
  readonly secrets: FakeSecretStore;
  readonly sourceRuns: FakeSourceRunRepository;
  readonly transaction: Transaction;
}

export const fakePersistence = (): FakePersistence => {
  const vehicles = fakeVehicleRepository();
  const settings = fakeSettingsRepository();
  const mailboxState = fakeMailboxStateRepository();
  const pushSubscriptions = fakePushSubscriptionRepository();
  const sessions = fakeSessionRepository();
  const secrets = fakeSecretStore();
  const sourceRuns = fakeSourceRunRepository();
  return {
    vehicles,
    settings,
    mailboxState,
    pushSubscriptions,
    sessions,
    secrets,
    sourceRuns,
    transaction: fakeTransaction(vehicles, settings, mailboxState, pushSubscriptions, sessions, secrets, sourceRuns),
  };
};
