import { describe } from 'vitest';
import { fakeSessionRepository } from '../fakes/fakeSessionRepository.js';
import { sessionRepositoryContract } from './sessionRepository.contract.js';

describe('SessionRepository en mémoire', () => {
  sessionRepositoryContract(fakeSessionRepository);
});
