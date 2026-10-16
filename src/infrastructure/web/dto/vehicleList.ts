import type { ListVehiclesRequest, VehicleList } from '../../../application/vehicles/listVehicles.js';
import type { VehiclesResponse } from '../../../shared/api.js';
import type { VehiclesQuerystring } from '../schemas/vehicles.js';
import { vehicleCardDto } from './vehicle.js';
import { cursorText, vehicleCursorOf } from './vehicleCursor.js';

export const listVehiclesRequestOf = (query: VehiclesQuerystring): ListVehiclesRequest => ({
  status: query.status,
  kind: query.kind,
  days: query.days,
  limit: query.limit,
  after: query.cursor === undefined ? undefined : vehicleCursorOf(query.cursor),
});

export const vehicleListDto = (list: VehicleList): VehiclesResponse => ({
  vehicles: list.vehicles.map(vehicleCardDto),
  nextCursor: list.nextCursor === undefined ? null : cursorText(list.nextCursor),
  kinds: list.rejectedCounts,
});
