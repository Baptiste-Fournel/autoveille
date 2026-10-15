import type { Clock } from '../ports/clock.js';

const MAX_FAILED_ATTEMPTS = 8;

const ATTEMPT_WINDOW_MS = 10 * 60_000;

export interface AttemptLimiter {
  readonly blocked: (key: string) => boolean;
  readonly fail: (key: string) => void;
  readonly reset: (key: string) => void;
}

interface FailedAttempts {
  readonly count: number;
  readonly windowEndsAt: number;
}

export const createAttemptLimiter = (clock: Clock): AttemptLimiter => {
  const failures = new Map<string, FailedAttempts>();
  const now = (): number => Date.parse(clock.now());
  return {
    blocked: (key) => {
      const attempts = failures.get(key);
      if (attempts === undefined) {
        return false;
      }
      if (now() > attempts.windowEndsAt) {
        failures.delete(key);
        return false;
      }
      return attempts.count >= MAX_FAILED_ATTEMPTS;
    },
    fail: (key) => {
      const attempts = failures.get(key);
      const instant = now();
      failures.set(
        key,
        attempts === undefined || instant > attempts.windowEndsAt
          ? { count: 1, windowEndsAt: instant + ATTEMPT_WINDOW_MS }
          : { ...attempts, count: attempts.count + 1 },
      );
    },
    reset: (key) => {
      failures.delete(key);
    },
  };
};
