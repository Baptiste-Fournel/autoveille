import type { RejectedKindCountsDto, VehicleDto } from '../../../src/shared/api';
import { belongsTo, enters, type ListKey } from './listKey';

export interface VehicleList {
  readonly key: ListKey;
  readonly vehicles: readonly VehicleDto[];
  readonly nextCursor: string | null;
  readonly kinds: RejectedKindCountsDto | null;
  readonly loaded: boolean;
  readonly loadingMore: boolean;
}

export const emptyList = (key: ListKey): VehicleList => ({
  key,
  vehicles: [],
  nextCursor: null,
  kinds: null,
  loaded: false,
  loadingMore: false,
});

const sortDateOf = (vehicle: VehicleDto): string => vehicle.publishedAt ?? vehicle.firstSeenAt;

const comesBefore = (vehicle: VehicleDto, other: VehicleDto): boolean =>
  sortDateOf(vehicle) > sortDateOf(other) || (sortDateOf(vehicle) === sortDateOf(other) && vehicle.id < other.id);

const without = (list: VehicleList, index: number): VehicleList => ({
  ...list,
  vehicles: list.vehicles.filter((_, position) => position !== index),
});

const withReplaced = (list: VehicleList, index: number, vehicle: VehicleDto): VehicleList => ({
  ...list,
  vehicles: list.vehicles.map((shown, position) => (position === index ? vehicle : shown)),
});

const withInserted = (list: VehicleList, vehicle: VehicleDto): VehicleList => {
  const position = list.vehicles.findIndex((other) => comesBefore(vehicle, other));
  if (position === -1 && list.nextCursor !== null) {
    return list;
  }
  const at = position === -1 ? list.vehicles.length : position;
  return { ...list, vehicles: [...list.vehicles.slice(0, at), vehicle, ...list.vehicles.slice(at)] };
};

const indexOf = (list: VehicleList, id: number): number => list.vehicles.findIndex((shown) => shown.id === id);

export const withVehicle = (list: VehicleList, vehicle: VehicleDto): VehicleList => {
  if (!list.loaded) {
    return list;
  }
  const index = indexOf(list, vehicle.id);
  if (index === -1) {
    return enters(vehicle, list.key) ? withInserted(list, vehicle) : list;
  }
  return belongsTo(vehicle, list.key) ? withReplaced(list, index, vehicle) : without(list, index);
};

export const withVehicleBack = (list: VehicleList, vehicle: VehicleDto, wasListed: boolean): VehicleList => {
  if (!list.loaded) {
    return list;
  }
  const index = indexOf(list, vehicle.id);
  if (!wasListed) {
    return index === -1 ? list : without(list, index);
  }
  return index === -1 ? withInserted(list, vehicle) : withReplaced(list, index, vehicle);
};

export const withoutVehicle = (list: VehicleList, id: number): VehicleList => {
  const index = indexOf(list, id);
  return index === -1 ? list : without(list, index);
};

export const withNextPage = (list: VehicleList, vehicles: readonly VehicleDto[], nextCursor: string | null): VehicleList => {
  const shown = new Set(list.vehicles.map((vehicle) => vehicle.id));
  return { ...list, vehicles: [...list.vehicles, ...vehicles.filter((vehicle) => !shown.has(vehicle.id))], nextCursor, loadingMore: false };
};
