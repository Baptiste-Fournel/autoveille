import type { Clock } from '../../src/application/ports/clock.js';

export interface SteppingClock extends Clock {
  readonly advanceBy: (milliseconds: number) => void;
}

export const steppingClock = (startIso: string, stepMilliseconds = 1000): SteppingClock => {
  let current = Date.parse(startIso);
  const read = (): number => {
    const instant = current;
    current += stepMilliseconds;
    return instant;
  };
  return {
    now: () => new Date(read()).toISOString(),
    startOfToday: () => {
      const start = new Date(read());
      start.setHours(0, 0, 0, 0);
      return start.toISOString();
    },
    advanceBy: (milliseconds) => {
      current += milliseconds;
    },
  };
};
