import type { SettingsRepository } from '../../src/application/ports/settingsRepository.js';
import { defaultSettings } from '../../src/domain/settings/defaults.js';
import type { Settings } from '../../src/domain/settings/types.js';
import type { TransactionParticipant } from './fakeTransaction.js';

export type FakeSettingsRepository = SettingsRepository & TransactionParticipant;

export const fakeSettingsRepository = (initial?: Settings): FakeSettingsRepository => {
  let saved: Settings | undefined = initial;
  return {
    load: () => saved ?? defaultSettings(),
    save: (settings) => {
      saved = settings;
    },
    snapshot: () => {
      const kept = saved;
      return () => {
        saved = kept;
      };
    },
  };
};
