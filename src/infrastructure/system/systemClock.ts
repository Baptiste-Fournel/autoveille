import type { Clock } from '../../application/ports/clock.js';

export const systemClock: Clock = {
  now: () => new Date().toISOString(),
  startOfToday: () => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    return start.toISOString();
  },
};
