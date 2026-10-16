import { describe } from 'vitest';
import { fakePushSubscriptionRepository } from '../fakes/fakePushSubscriptionRepository.js';
import { pushSubscriptionRepositoryContract } from './pushSubscriptionRepository.contract.js';

describe('PushSubscriptionRepository en mémoire', () => {
  pushSubscriptionRepositoryContract(fakePushSubscriptionRepository);
});
