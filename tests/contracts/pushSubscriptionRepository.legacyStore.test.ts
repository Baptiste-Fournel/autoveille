import { describe } from 'vitest';
import { Store } from '../../src/db.js';
import { storeRepositories } from '../../src/storeRepositories.js';
import { pushSubscriptionRepositoryContract } from './pushSubscriptionRepository.contract.js';

describe('PushSubscriptionRepository sur l’ancien Store (adaptateur transitoire)', () => {
  pushSubscriptionRepositoryContract(() => storeRepositories(new Store(':memory:')).subscriptions);
});
