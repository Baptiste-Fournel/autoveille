import { batch, computed, type ReadonlySignal, type Signal, signal } from '@preact/signals';
import type { VehicleDto, VehiclesResponse } from '../../../src/shared/api';
import type { ApiClient } from '../api/client';
import { errorText } from '../api/errorText';
import { listedVehicle } from './listedVehicle';
import { DEFAULT_LIST, type ListKey, listIdOf, listQueryOf } from './listKey';
import { emptyList, type VehicleList, withNextPage, withoutVehicle, withVehicle, withVehicleBack } from './vehicleList';

const VEHICLE_PAGE_SIZE = 50;

const LARGEST_PAGE = 1000;

export type Placement = ReadonlySet<string>;

export interface VehicleLists {
  readonly selected: ReadonlySignal<ListKey>;
  readonly search: Signal<string>;
  readonly current: ReadonlySignal<VehicleList>;
  readonly select: (key: ListKey) => Promise<void>;
  readonly revalidate: () => Promise<void>;
  readonly revalidateRejected: () => Promise<void>;
  readonly loadMore: () => Promise<void>;
  readonly find: (id: number) => VehicleDto | undefined;
  readonly put: (vehicle: VehicleDto) => void;
  readonly placementOf: (id: number) => Placement;
  readonly putBack: (vehicle: VehicleDto, placement: Placement) => void;
  readonly drop: (id: number) => void;
}

export interface VehicleListsDependencies {
  readonly api: ApiClient;
  readonly showError: (text: string) => void;
}

interface Validator {
  readonly etag: string | null;
  readonly limit: number | undefined;
}

const windowLimitOf = (list: VehicleList): number | undefined =>
  list.vehicles.length > VEHICLE_PAGE_SIZE ? Math.min(LARGEST_PAGE, list.vehicles.length) : undefined;

const loadedList = (key: ListKey, page: VehiclesResponse): VehicleList => ({
  key,
  vehicles: page.vehicles,
  nextCursor: page.nextCursor,
  kinds: page.kinds ?? null,
  loaded: true,
  loadingMore: false,
});

export const createVehicleLists = ({ api, showError }: VehicleListsDependencies): VehicleLists => {
  const selected = signal<ListKey>(DEFAULT_LIST);
  const search = signal('');
  const lists = signal<ReadonlyMap<string, VehicleList>>(new Map());
  const validators = new Map<string, Validator>();
  const current = computed(() => lists.value.get(listIdOf(selected.value)) ?? emptyList(selected.value));

  const store = (list: VehicleList): void => {
    lists.value = new Map([...lists.value, [listIdOf(list.key), list]]);
  };

  const everyList = (change: (list: VehicleList, id: string) => VehicleList): void => {
    lists.value = new Map([...lists.value].map(([id, list]) => [id, change(list, id)]));
  };

  const revalidate = async (): Promise<void> => {
    const key = selected.value;
    const id = listIdOf(key);
    const shown = lists.value.get(id) ?? emptyList(key);
    const limit = windowLimitOf(shown);
    const validator = validators.get(id);
    const etag = shown.loaded && validator !== undefined && validator.limit === limit ? validator.etag : null;
    try {
      const answer = await api.vehiclesIfChanged(limit === undefined ? listQueryOf(key) : { ...listQueryOf(key), limit }, etag);
      if (!answer.changed || (shown.loaded && lists.value.get(id) !== shown)) {
        return;
      }
      validators.set(id, { etag: answer.etag, limit });
      store(loadedList(key, answer.body));
    } catch {
      return;
    }
  };

  return {
    selected,
    search,
    current,
    select: (key) => {
      batch(() => {
        selected.value = key;
        search.value = '';
      });
      return revalidate();
    },
    revalidate,
    revalidateRejected: () => (selected.value.status === 'ecartees' ? revalidate() : Promise.resolve()),
    loadMore: async () => {
      const shown = current.value;
      if (shown.nextCursor === null || shown.loadingMore) {
        return;
      }
      store({ ...shown, loadingMore: true });
      try {
        const page = await api.vehicles({ ...listQueryOf(shown.key), cursor: shown.nextCursor });
        const latest = lists.value.get(listIdOf(shown.key)) ?? shown;
        store(withNextPage(latest, page.vehicles, page.nextCursor));
      } catch (error) {
        store({ ...(lists.value.get(listIdOf(shown.key)) ?? shown), loadingMore: false });
        showError(errorText(error));
      }
    },
    find: (id) => {
      for (const list of lists.value.values()) {
        const found = list.vehicles.find((vehicle) => vehicle.id === id);
        if (found !== undefined) {
          return found;
        }
      }
      return undefined;
    },
    put: (vehicle) => everyList((list) => withVehicle(list, listedVehicle(vehicle))),
    placementOf: (id) =>
      new Set([...lists.value].filter(([, list]) => list.vehicles.some((vehicle) => vehicle.id === id)).map(([listId]) => listId)),
    putBack: (vehicle, placement) => everyList((list, id) => withVehicleBack(list, listedVehicle(vehicle), placement.has(id))),
    drop: (id) => everyList((list) => withoutVehicle(list, id)),
  };
};
