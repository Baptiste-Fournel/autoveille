import type { DeadlineTimers } from './deadline.js';

export interface Web<Handle> {
  readonly fetch: typeof fetch;
  readonly timers: DeadlineTimers<Handle>;
}
