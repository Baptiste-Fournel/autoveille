import type { Transaction } from '../../src/application/ports/transaction.js';

export interface TransactionParticipant {
  readonly snapshot: () => () => void;
}

const restoreAll = (restores: readonly (() => void)[]): void => {
  for (const restore of restores) {
    restore();
  }
};

export const fakeTransaction = (...participants: readonly TransactionParticipant[]): Transaction => ({
  run<T>(work: () => T): T {
    const restores = participants.map((participant) => participant.snapshot());
    try {
      const result = work();
      if (result instanceof Promise) {
        throw new TypeError('Transaction function cannot return a promise');
      }
      return result;
    } catch (error) {
      restoreAll(restores);
      throw error;
    }
  },
});
