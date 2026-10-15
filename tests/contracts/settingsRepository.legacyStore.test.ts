import { describe } from 'vitest';
import { Store } from '../../src/db.js';
import { storeRepositories } from '../../src/storeRepositories.js';
import { settingsRepositoryContract } from './settingsRepository.contract.js';

describe('SettingsRepository sur l’ancien Store (adaptateur transitoire)', () => {
  settingsRepositoryContract(() => storeRepositories(new Store(':memory:')).settings);
});
