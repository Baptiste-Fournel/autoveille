import { describe } from 'vitest';
import { Store } from '../../src/db.js';
import { storeRepositories } from '../../src/storeRepositories.js';
import { mailboxStateRepositoryContract } from './mailboxStateRepository.contract.js';

describe('MailboxStateRepository sur l’ancien Store (adaptateur transitoire)', () => {
  mailboxStateRepositoryContract(() => storeRepositories(new Store(':memory:')).mailboxState);
});
