import { randomBytes } from 'node:crypto';
import type { Clock } from './application/ports/clock.js';
import type { Logger } from './application/ports/logger.js';
import type { Random } from './application/ports/random.js';

export const systemClock: Clock = {
  now: () => new Date().toISOString(),
  startOfToday: () => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    return start.toISOString();
  },
};

export const systemRandom: Random = {
  hexToken: (bytes) => randomBytes(bytes).toString('hex'),
  shortId: () => Math.random().toString(36).slice(2, 10),
};

export const loggerWriting = (write: (message: string) => void): Logger => ({ info: write });
