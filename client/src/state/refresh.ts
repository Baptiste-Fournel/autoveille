import { type ReadonlySignal, signal } from '@preact/signals';

export interface Refresh {
  readonly now: ReadonlySignal<number>;
  readonly request: () => void;
  readonly touch: () => void;
  readonly subscribe: (listener: () => void) => () => void;
}

export const createRefresh = (clock: () => number): Refresh => {
  const now = signal(clock());
  const listeners = new Set<() => void>();
  const touch = (): void => {
    now.value = clock();
  };
  return {
    now,
    touch,
    request: () => {
      touch();
      for (const listener of listeners) {
        listener();
      }
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
};
