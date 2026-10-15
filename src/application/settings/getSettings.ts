import type { Settings } from '../../domain/settings/types.js';
import type { SettingsRepository } from '../ports/settingsRepository.js';

export interface GetSettingsDependencies {
  readonly settings: SettingsRepository;
}

export const getSettings = ({ settings }: GetSettingsDependencies): Settings => settings.load();
