const DAY_MILLISECONDS = 86_400_000;

export const daysBefore = (instant: string, days: number): string => new Date(Date.parse(instant) - days * DAY_MILLISECONDS).toISOString();
