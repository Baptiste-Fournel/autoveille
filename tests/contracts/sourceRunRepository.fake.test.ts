import { describe } from 'vitest';
import { fakeSourceRunRepository } from '../fakes/fakeSourceRunRepository.js';
import { sourceRunRepositoryContract } from './sourceRunRepository.contract.js';

describe('SourceRunRepository en mémoire', () => {
  sourceRunRepositoryContract(fakeSourceRunRepository);
});
