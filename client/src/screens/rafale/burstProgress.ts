import type { VehicleUpdateRequest } from '../../../../src/shared/api';
import type { BurstProgress } from '../../state/burst';

const sentBy = (change: VehicleUpdateRequest): boolean => change.status === 'contacte';

const ignoredBy = (change: VehicleUpdateRequest): boolean => change.status === 'ignore' || change.doNotContact === true;

export const startedBurst = (ids: readonly number[]): BurstProgress => ({ ids, index: 0, sent: 0, ignored: 0, skipped: 0 });

export const isOver = (progress: BurstProgress): boolean => !progress.ids.length || progress.index >= progress.ids.length;

export const purgedBurst = (progress: BurstProgress, stillToHandle: ReadonlySet<number>, known: ReadonlySet<number>): BurstProgress => {
  const handled = progress.ids.slice(0, progress.index).filter((id) => known.has(id));
  const upcoming = progress.ids.slice(progress.index).filter((id) => stillToHandle.has(id));
  return { ...progress, ids: [...handled, ...upcoming], index: handled.length };
};

export const skippedInBurst = (progress: BurstProgress): BurstProgress => ({
  ...progress,
  skipped: progress.skipped + 1,
  index: progress.index + 1,
});

export const actedInBurst = (progress: BurstProgress, change: VehicleUpdateRequest): BurstProgress => {
  if (sentBy(change)) {
    return { ...progress, sent: progress.sent + 1, index: progress.index + 1 };
  }
  if (ignoredBy(change)) {
    return { ...progress, ignored: progress.ignored + 1, index: progress.index + 1 };
  }
  return { ...progress, index: progress.index + 1 };
};

export const undoneInBurst = (progress: BurstProgress, change: VehicleUpdateRequest): BurstProgress => {
  const back = Math.max(0, progress.index - 1);
  if (sentBy(change)) {
    return { ...progress, sent: Math.max(0, progress.sent - 1), index: back };
  }
  if (ignoredBy(change)) {
    return { ...progress, ignored: Math.max(0, progress.ignored - 1), index: back };
  }
  return { ...progress, index: back };
};
