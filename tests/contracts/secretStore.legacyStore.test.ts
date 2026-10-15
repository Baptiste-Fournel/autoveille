import { describe } from 'vitest';
import { Store } from '../../src/db.js';
import { storeRepositories } from '../../src/storeRepositories.js';
import { secretStoreContract } from './secretStore.contract.js';

describe('SecretStore sur l’ancien Store (adaptateur transitoire)', () => {
  secretStoreContract(() => storeRepositories(new Store(':memory:')).secrets);
});
