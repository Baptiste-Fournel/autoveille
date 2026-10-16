export interface Timers<Handle> {
  readonly setInterval: (task: () => void, delayMs: number) => Handle;
  readonly clearInterval: (handle: Handle) => void;
  readonly setTimeout: (task: () => void, delayMs: number) => Handle;
  readonly clearTimeout: (handle: Handle) => void;
}

export const systemTimers: Timers<NodeJS.Timeout> = {
  setInterval: (task, delayMs) => setInterval(task, delayMs),
  clearInterval: (handle) => clearInterval(handle),
  setTimeout: (task, delayMs) => setTimeout(task, delayMs),
  clearTimeout: (handle) => clearTimeout(handle),
};
