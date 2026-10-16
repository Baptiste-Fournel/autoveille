import { devicePreferences } from './storage/preferences';
import { applyStoredTheme } from './theme/storedTheme';

applyStoredTheme(
  document,
  devicePreferences(() => window.localStorage),
);
