import type { SourceRun, SourceRunRepository } from '../../src/application/ports/sourceRunRepository.js';
import type { TransactionParticipant } from './fakeTransaction.js';

export type FakeSourceRunRepository = SourceRunRepository & TransactionParticipant;

export const fakeSourceRunRepository = (): FakeSourceRunRepository => {
  let runs: readonly SourceRun[] = [];
  return {
    record: (run) => {
      const known = runs.some((existing) => existing.source === run.source);
      runs = known ? runs.map((existing) => (existing.source === run.source ? run : existing)) : [...runs, run];
    },
    all: () => runs,
    snapshot: () => {
      const kept = runs;
      return () => {
        runs = kept;
      };
    },
  };
};
