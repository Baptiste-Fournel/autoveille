import { daysBefore } from './daysBefore.js';

export const daysAfter = (instant: string, days: number): string => daysBefore(instant, -days);
