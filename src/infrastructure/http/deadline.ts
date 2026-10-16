export interface DeadlineTimers<Handle> {
  readonly setTimeout: (task: () => void, delayMs: number) => Handle;
  readonly clearTimeout: (handle: Handle) => void;
}

export const withDeadline = async <T, Handle>(
  timers: DeadlineTimers<Handle>,
  delayMs: number,
  work: (signal: AbortSignal) => Promise<T>,
): Promise<T> => {
  const controller = new AbortController();
  const timer = timers.setTimeout(() => controller.abort(), delayMs);
  try {
    return await work(controller.signal);
  } finally {
    timers.clearTimeout(timer);
  }
};
