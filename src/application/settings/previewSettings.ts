import { type ReevaluationDependencies, type ReevaluationPreview, reevaluateVehicles } from '../ingest/reevaluateVehicles.js';
import { readSubmittedSettings, type SubmittedSettings, type SubmittedSettingsDependencies } from './submittedSettings.js';

export interface PreviewSettingsDependencies extends SubmittedSettingsDependencies, ReevaluationDependencies {}

export const previewSettings = async (
  dependencies: PreviewSettingsDependencies,
  submitted: SubmittedSettings,
): Promise<ReevaluationPreview> => {
  const { settings } = await readSubmittedSettings(dependencies, submitted);
  return reevaluateVehicles(dependencies, { settings, persist: false });
};
