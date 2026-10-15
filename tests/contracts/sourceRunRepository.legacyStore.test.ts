import { describe } from 'vitest';
import { Store } from '../../src/db.js';
import { storeRepositories } from '../../src/storeRepositories.js';
import { sourceRunRepositoryContract } from './sourceRunRepository.contract.js';

describe('SourceRunRepository sur l’ancien Store (adaptateur transitoire)', () => {
  sourceRunRepositoryContract(() => storeRepositories(new Store(':memory:')).sourceRuns);
});
