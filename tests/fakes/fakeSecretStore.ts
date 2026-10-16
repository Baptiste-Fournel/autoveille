import type { SecretKey, SecretStore } from '../../src/application/ports/secretStore.js';
import type { TransactionParticipant } from './fakeTransaction.js';

export type FakeSecretStore = SecretStore & TransactionParticipant;

type Secrets = Readonly<Partial<Record<SecretKey, string>>>;

export const fakeSecretStore = (initial: Secrets = {}): FakeSecretStore => {
  let secrets: Secrets = initial;
  return {
    get: (key) => secrets[key],
    set: (key, value) => {
      secrets = { ...secrets, [key]: value };
    },
    matches: (key, candidate) => {
      const secret = secrets[key];
      return secret !== undefined && secret === candidate;
    },
    snapshot: () => {
      const kept = secrets;
      return () => {
        secrets = kept;
      };
    },
  };
};
