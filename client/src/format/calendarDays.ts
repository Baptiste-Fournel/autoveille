const DAY_MS = 86_400_000;

const startOfLocalDay = (time: number): number => new Date(time).setHours(0, 0, 0, 0);

export const calendarDaysBetween = (earlier: number, later: number): number =>
  Math.round((startOfLocalDay(later) - startOfLocalDay(earlier)) / DAY_MS);
