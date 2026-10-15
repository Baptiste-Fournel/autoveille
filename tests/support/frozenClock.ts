import { vi } from 'vitest';

const SystemDate = globalThis.Date;

type DateArguments =
  | []
  | [value: number | string | Date]
  | [year: number, monthIndex: number, day?: number, hours?: number, minutes?: number, seconds?: number, milliseconds?: number];

export interface FrozenClock {
  readonly advanceBy: (milliseconds: number) => void;
}

export function installFrozenClock(startIso: string, stepMilliseconds = 1000): FrozenClock {
  const state = { now: SystemDate.parse(startIso) };
  const read = (): number => {
    const current = state.now;
    state.now += stepMilliseconds;
    return current;
  };
  const instantOf = (value: number | string | Date): number | string => (typeof value === 'object' ? value.getTime() : value);

  class FrozenDate extends SystemDate {
    constructor(...args: DateArguments) {
      if (args.length === 0) super(read());
      else if (args.length === 1) super(instantOf(args[0]));
      else super(args[0], args[1], args[2] ?? 1, args[3] ?? 0, args[4] ?? 0, args[5] ?? 0, args[6] ?? 0);
    }

    static override now(): number {
      return read();
    }
  }

  vi.stubGlobal('Date', FrozenDate);
  return {
    advanceBy: (milliseconds) => {
      state.now += milliseconds;
    },
  };
}
