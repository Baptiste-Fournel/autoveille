import type { Clock } from '../../src/application/ports/clock.js';

export const FAKE_NOW = '2026-10-15T08:30:00.000Z';

export interface FakeClock extends Clock {
  readonly set: (instant: string) => void;
  readonly advanceBy: (milliseconds: number) => void;
}

const DAY_LENGTH = 'YYYY-MM-DD'.length;

export const fakeClock = (): FakeClock => {
  let current = Date.parse(FAKE_NOW);
  const now = (): string => new Date(current).toISOString();
  return {
    now,
    startOfToday: () => `${now().slice(0, DAY_LENGTH)}T00:00:00.000Z`,
    set: (instant) => {
      current = Date.parse(instant);
    },
    advanceBy: (milliseconds) => {
      current += milliseconds;
    },
  };
};
