import type { SettingsProblem } from '../settings/invalidSettings.js';
import type { ZoneWarning } from '../settings/zoneWarning.js';

export const UNNAMED_HTTP_SITE = 'Site';

const SETTINGS_PROBLEM_TEXTS: Readonly<Record<SettingsProblem, string>> = {
  missingZoneCity: 'Indiquez la ville de la zone.',
};

export const settingsProblemText = (problem: SettingsProblem): string => SETTINGS_PROBLEM_TEXTS[problem];

const ZONE_WARNING_TEXTS: Readonly<Record<ZoneWarning, string>> = {
  cityNotFound: 'Ville introuvable : le filtre de distance est désactivé tant que la ville n’est pas reconnue.',
  cityLocatedByDepartment: 'Ville non reconnue précisément : distance calculée depuis le centre du département.',
};

export const zoneWarningText = (warning: ZoneWarning): string => ZONE_WARNING_TEXTS[warning];
