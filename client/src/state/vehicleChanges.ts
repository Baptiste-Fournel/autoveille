import type { Signal } from '@preact/signals';
import type { VehicleDto, VehicleUpdateRequest } from '../../../src/shared/api';
import type { ApiClient } from '../api/client';
import { errorText } from '../api/errorText';
import type { Overview } from './overview';
import { predictedVehicle, undoOf } from './predictedVehicle';
import type { Toast } from './toast';
import type { VehicleLists } from './vehicleLists';
import type { VehicleSheet } from './vehicleSheet';

const UNDONE_TEXT = 'Annulé';

export interface ActOptions {
  readonly onUndone?: () => void;
}

export interface VehicleChanges {
  readonly save: (vehicle: VehicleDto, change: VehicleUpdateRequest) => Promise<VehicleDto | null>;
  readonly act: (
    vehicle: VehicleDto,
    change: VehicleUpdateRequest,
    confirmation: string,
    options?: ActOptions,
  ) => Promise<VehicleDto | null>;
  readonly remove: (vehicle: VehicleDto) => Promise<boolean>;
}

export interface VehicleChangesDependencies {
  readonly api: ApiClient;
  readonly lists: Pick<VehicleLists, 'put' | 'placementOf' | 'putBack' | 'revalidateRejected' | 'drop'>;
  readonly sheet: Pick<VehicleSheet, 'put'>;
  readonly overview: Pick<Overview, 'shift' | 'refresh'>;
  readonly toast: Pick<Toast, 'show'>;
  readonly pendingConfirmation: Signal<number | null>;
  readonly clock: () => number;
}

export const createVehicleChanges = ({
  api,
  lists,
  sheet,
  overview,
  toast,
  pendingConfirmation,
  clock,
}: VehicleChangesDependencies): VehicleChanges => {
  const queues = new Map<number, Promise<unknown>>();

  const show = (vehicle: VehicleDto): void => {
    lists.put(vehicle);
    sheet.put(vehicle);
  };

  const inTurn = <T>(id: number, send: () => Promise<T>): Promise<T> => {
    const turn = (queues.get(id) ?? Promise.resolve()).then(send, send);
    queues.set(id, turn);
    return turn;
  };

  const save = (vehicle: VehicleDto, change: VehicleUpdateRequest): Promise<VehicleDto | null> => {
    const expected = predictedVehicle(vehicle, change, clock());
    const placement = lists.placementOf(vehicle.id);
    show(expected);
    overview.shift(vehicle, expected);
    return inTurn(vehicle.id, async () => {
      try {
        const saved = await api.updateVehicle(vehicle.id, change);
        show(saved);
        void overview.refresh();
        if (!vehicle.matched) {
          void lists.revalidateRejected();
        }
        return saved;
      } catch (error) {
        lists.putBack(vehicle, placement);
        sheet.put(vehicle);
        overview.shift(expected, vehicle);
        toast.show(errorText(error), { error: true });
        return null;
      }
    });
  };

  return {
    save,
    act: async (vehicle, change, confirmation, options = {}) => {
      if (pendingConfirmation.value === vehicle.id) {
        pendingConfirmation.value = null;
      }
      const undo = undoOf(vehicle, change);
      let latest = predictedVehicle(vehicle, change, clock());
      const restore = async (): Promise<void> => {
        if (undo !== null && (await save(latest, undo)) !== null) {
          toast.show(UNDONE_TEXT);
          options.onUndone?.();
        }
      };
      toast.show(confirmation, undo === null ? {} : { undo: restore });
      const saved = await save(vehicle, change);
      latest = saved ?? latest;
      return saved;
    },
    remove: async (vehicle) => {
      try {
        await api.deleteVehicle(vehicle.id);
        lists.drop(vehicle.id);
        void overview.refresh();
        return true;
      } catch (error) {
        toast.show(errorText(error), { error: true });
        return false;
      }
    },
  };
};
