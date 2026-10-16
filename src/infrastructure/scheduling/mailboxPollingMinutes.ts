const SAFETY_NET_MINUTES_WHILE_WATCHED = 10;

export const mailboxPollingMinutes = (configuredMinutes: number, watchedByIdle: boolean): number =>
  watchedByIdle ? Math.max(configuredMinutes, SAFETY_NET_MINUTES_WHILE_WATCHED) : configuredMinutes;
