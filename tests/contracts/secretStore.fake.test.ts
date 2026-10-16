import { describe } from 'vitest';
import { fakeSecretStore } from '../fakes/fakeSecretStore.js';
import { secretStoreContract } from './secretStore.contract.js';

describe('SecretStore en mémoire', () => {
  secretStoreContract(() => fakeSecretStore());
});
