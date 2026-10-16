import { calendarDaysBetween } from './calendarDays';

export const daysAgo = (iso: string | null | undefined, now: number): string => {
  if (!iso) {
    return '';
  }
  const days = calendarDaysBetween(new Date(iso).getTime(), now);
  if (days <= 0) {
    return 'aujourd’hui';
  }
  return days === 1 ? 'hier' : `il y a ${days} j`;
};
