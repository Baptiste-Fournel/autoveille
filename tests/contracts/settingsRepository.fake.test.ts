import { describe } from 'vitest';
import { fakeSettingsRepository } from '../fakes/fakeSettingsRepository.js';
import { settingsRepositoryContract } from './settingsRepository.contract.js';

describe('SettingsRepository en mémoire', () => {
  settingsRepositoryContract(() => fakeSettingsRepository());
});
