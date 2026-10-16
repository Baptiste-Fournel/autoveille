import { type ReadonlySignal, signal } from '@preact/signals';
import type { VehicleDto } from '../../../src/shared/api';
import { ApiError } from '../api/ApiError';
import type { ApiClient } from '../api/client';

const NOT_FOUND = 404;

export interface SheetState {
  readonly id: number;
  readonly vehicle: VehicleDto | null;
  readonly missing: boolean;
}

export interface VehicleSheet {
  readonly current: ReadonlySignal<SheetState | null>;
  readonly open: (id: number) => Promise<void>;
  readonly reload: () => Promise<void>;
  readonly put: (vehicle: VehicleDto) => void;
}

export interface VehicleSheetDependencies {
  readonly api: ApiClient;
  readonly cached: (id: number) => VehicleDto | undefined;
}

export const isSameVehicleId = (shown: number | undefined, wanted: number): boolean => Object.is(shown, wanted);

export const createVehicleSheet = ({ api, cached }: VehicleSheetDependencies): VehicleSheet => {
  const current = signal<SheetState | null>(null);
  let etag: string | null = null;

  const isShowing = (id: number): boolean => isSameVehicleId(current.value?.id, id);

  const fetchInto = async (id: number, keepOnNetworkFailure: boolean): Promise<void> => {
    try {
      const answer = await api.vehicleIfChanged(id, etag);
      if (answer.changed && isShowing(id)) {
        current.value = { id, vehicle: answer.body, missing: false };
        etag = answer.etag;
      }
    } catch (error) {
      const gone = !keepOnNetworkFailure || (error instanceof ApiError && error.status === NOT_FOUND);
      if (gone && isShowing(id)) {
        current.value = { id, vehicle: null, missing: true };
      }
    }
  };

  return {
    current,
    open: (id) => {
      etag = null;
      current.value = { id, vehicle: cached(id) ?? null, missing: false };
      return fetchInto(id, false);
    },
    reload: async () => {
      const shown = current.value;
      if (shown !== null) {
        await fetchInto(shown.id, true);
      }
    },
    put: (vehicle) => {
      if (isShowing(vehicle.id)) {
        etag = null;
        current.value = { id: vehicle.id, vehicle, missing: false };
      }
    },
  };
};
