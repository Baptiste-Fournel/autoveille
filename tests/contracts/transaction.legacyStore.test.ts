import { describe } from 'vitest';
import { Store } from '../../src/db.js';
import { storeRepositories } from '../../src/storeRepositories.js';
import { transactionContract } from './transaction.contract.js';

describe('Transaction sur l’ancien Store (adaptateur transitoire)', () => {
  transactionContract(() => storeRepositories(new Store(':memory:')));
});
