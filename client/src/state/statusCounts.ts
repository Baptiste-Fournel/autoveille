import type { Status, StatusCountsDto, VehicleDto } from '../../../src/shared/api';

type Counted = Pick<VehicleDto, 'matched' | 'status'>;

const countedStatus = (vehicle: Counted): Status | null => (vehicle.matched ? vehicle.status : null);

export const shiftedCounts = <Counts extends StatusCountsDto>(counts: Counts, before: Counted, after: Counted): Counts => {
  const left = countedStatus(before);
  const entered = countedStatus(after);
  if (left === entered) {
    return counts;
  }
  const withoutLeft = left === null ? counts : { ...counts, [left]: Math.max(0, counts[left] - 1) };
  return entered === null ? withoutLeft : { ...withoutLeft, [entered]: withoutLeft[entered] + 1 };
};
