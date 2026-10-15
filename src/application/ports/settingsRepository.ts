import type { Settings } from '../../domain/settings/types.js';

export interface SettingsRepository {
  load(): Settings;
  save(settings: Settings): void;
}
