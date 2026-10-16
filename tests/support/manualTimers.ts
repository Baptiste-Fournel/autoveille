import type { Timers } from '../../src/infrastructure/scheduling/timers.js';

interface Timer {
  readonly id: number;
  readonly dueAt: number;
  readonly every?: number;
  readonly task: () => void;
}

export interface ManualTimers extends Timers<number> {
  readonly advanceBy: (delayMs: number) => void;
  readonly elapse: (delayMs: number) => Promise<void>;
}

const pendingWorkDone = (): Promise<void> =>
  new Promise((resolve) => {
    setImmediate(resolve);
  });

export const manualTimers = (): ManualTimers => {
  let now = 0;
  let created = 0;
  let pending: readonly Timer[] = [];
  const schedule = (task: () => void, delayMs: number, every?: number): number => {
    created += 1;
    pending = [...pending, { id: created, dueAt: now + delayMs, every, task }];
    return created;
  };
  const cancel = (id: number): void => {
    pending = pending.filter((timer) => timer.id !== id);
  };
  const runDueBy = (target: number): void => {
    const next = pending.filter((timer) => timer.dueAt <= target).sort((a, b) => a.dueAt - b.dueAt || a.id - b.id)[0];
    if (next === undefined) {
      now = target;
      return;
    }
    now = next.dueAt;
    pending = pending.flatMap((timer) =>
      timer.id !== next.id ? [timer] : next.every === undefined ? [] : [{ ...next, dueAt: next.dueAt + next.every }],
    );
    next.task();
    runDueBy(target);
  };
  const advanceBy = (delayMs: number): void => runDueBy(now + delayMs);
  return {
    setInterval: (task, delayMs) => schedule(task, delayMs, delayMs),
    clearInterval: cancel,
    setTimeout: (task, delayMs) => schedule(task, delayMs),
    clearTimeout: cancel,
    advanceBy,
    elapse: async (delayMs) => {
      await pendingWorkDone();
      advanceBy(delayMs);
      await pendingWorkDone();
    },
  };
};
