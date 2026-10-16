import type { Settings } from '../../domain/settings/types.js';
import type { ZoneWarning } from '../../domain/settings/zoneWarning.js';
import { type ReevaluationDependencies, type ReevaluationPreview, reevaluateVehicles } from '../ingest/reevaluateVehicles.js';
import { readSubmittedSettings, type SubmittedSettings, type SubmittedSettingsDependencies } from './submittedSettings.js';

export interface UpdateSettingsDependencies extends SubmittedSettingsDependencies, ReevaluationDependencies {}

export interface SettingsUpdate {
  readonly settings: Settings;
  readonly preview: ReevaluationPreview;
  readonly warning?: ZoneWarning;
}

export const updateSettings = async (dependencies: UpdateSettingsDependencies, submitted: SubmittedSettings): Promise<SettingsUpdate> => {
  const { settings, warning } = await readSubmittedSettings(dependencies, submitted);
  dependencies.settings.save(settings);
  const preview = reevaluateVehicles(dependencies, { settings, persist: true });
  return { settings, preview, warning };
};
