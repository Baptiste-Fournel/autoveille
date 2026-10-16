import type { ListedStatus, RejectedKind, VehicleDto, VehiclesQuery } from '../../../src/shared/api';

export interface ListKey {
  readonly status: ListedStatus;
  readonly kind: RejectedKind;
}

export const DEFAULT_LIST: ListKey = { status: 'nouveau', kind: 'suivies' };

export const listIdOf = (key: ListKey): string => (key.status === 'ecartees' ? `ecartees/${key.kind}` : key.status);

export const listQueryOf = (key: ListKey): VehiclesQuery =>
  key.status === 'ecartees' ? { status: key.status, kind: key.kind } : { status: key.status };

export const belongsTo = (vehicle: Pick<VehicleDto, 'matched' | 'status'>, key: ListKey): boolean => {
  switch (key.status) {
    case 'tous':
      return vehicle.matched;
    case 'ecartees':
      return !vehicle.matched;
    default:
      return vehicle.matched && vehicle.status === key.status;
  }
};

export const enters = (vehicle: Pick<VehicleDto, 'matched' | 'status'>, key: ListKey): boolean =>
  key.status !== 'ecartees' && belongsTo(vehicle, key);
