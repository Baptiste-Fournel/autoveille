import type { ReevaluationPreview } from '../../../application/ingest/reevaluateVehicles.js';
import type { SettingsUpdate } from '../../../application/settings/updateSettings.js';
import { FOLLOWED_FAMILIES } from '../../../domain/catalog/families.js';
import { FAMILY_LABELS } from '../../../domain/presentation/familyLabels.js';
import { settingsProblemText, zoneWarningText } from '../../../domain/presentation/settings.js';
import { VARIABLE_HELP } from '../../../domain/presentation/variableHelp.js';
import type { SettingsProblem } from '../../../domain/settings/invalidSettings.js';
import type { Settings } from '../../../domain/settings/types.js';
import type { SettingsPreviewDto, SettingsPreviewResponse, SettingsResponse, SettingsUpdateResponse } from '../../../shared/api.js';
import { withMaskedPassword } from './maskedSecrets.js';

export const settingsResponseDto = (settings: Settings): SettingsResponse => ({
  settings: withMaskedPassword(settings),
  variables: VARIABLE_HELP,
  families: FOLLOWED_FAMILIES.map((family) => ({ key: family, label: FAMILY_LABELS[family] })),
});

export const settingsPreviewDto = (preview: ReevaluationPreview): SettingsPreviewDto => ({ total: preview.total, pass: preview.pass });

export const refusedPreviewDto = (problem: SettingsProblem): SettingsPreviewResponse => ({
  error: settingsProblemText(problem),
  pass: 0,
  total: 0,
});

export const settingsUpdateDto = (update: SettingsUpdate): SettingsUpdateResponse => ({
  settings: withMaskedPassword(update.settings),
  preview: settingsPreviewDto(update.preview),
  warning: update.warning === undefined ? null : zoneWarningText(update.warning),
});
