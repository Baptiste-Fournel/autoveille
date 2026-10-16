import { type FakeClock, fakeClock } from '../fakes/fakeClock.js';

export const UPDATE_NIGHT = '2026-10-16T03:00:00.000Z';

export const updateNightClock = (): FakeClock => {
  const clock = fakeClock();
  clock.set(UPDATE_NIGHT);
  return clock;
};
