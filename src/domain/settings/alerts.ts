import type { AlertInfo, Settings } from './types.js';

const isOlderThanRecorded = (confirmation: AlertInfo, recorded: AlertInfo | undefined): boolean =>
  Boolean(recorded?.confirmedAt && confirmation.confirmedAt && confirmation.confirmedAt < recorded.confirmedAt);

export const recordAlertConfirmation = (settings: Settings, confirmation: AlertInfo): Settings =>
  isOlderThanRecorded(confirmation, settings.alerts[confirmation.site])
    ? settings
    : {
        ...settings,
        alertsDone: { ...settings.alertsDone, [confirmation.site]: true },
        alerts: { ...settings.alerts, [confirmation.site]: confirmation },
      };
