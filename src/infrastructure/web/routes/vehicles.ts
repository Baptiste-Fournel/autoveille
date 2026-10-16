import { deleteVehicle } from '../../../application/vehicles/deleteVehicle.js';
import { getVehicle } from '../../../application/vehicles/getVehicle.js';
import { listVehicles } from '../../../application/vehicles/listVehicles.js';
import { updateVehicle } from '../../../application/vehicles/updateVehicle.js';
import type { OkResponse, VehicleDto, VehiclesResponse, VehicleUpdateRequest } from '../../../shared/api.js';
import { OK } from '../dto/ok.js';
import { vehicleSheetDto } from '../dto/vehicle.js';
import { listVehiclesRequestOf, vehicleListDto } from '../dto/vehicleList.js';
import { unknownVehicleUnlessNumbered } from '../errors.js';
import type { RouteModule } from '../routeModule.js';
import {
  type VehicleAddress,
  type VehiclesQuerystring,
  vehicleAddressSchema,
  vehiclesQuerySchema,
  vehicleUpdateSchema,
} from '../schemas/vehicles.js';

export const vehicleListRoutes: RouteModule = (server, { ports }) => {
  server.get<{ Querystring: VehiclesQuerystring }>(
    '/api/vehicles',
    { schema: vehiclesQuerySchema },
    async (request): Promise<VehiclesResponse> => vehicleListDto(listVehicles(ports, listVehiclesRequestOf(request.query))),
  );
};

export const vehicleSheetRoutes: RouteModule = (server, { ports }) => {
  server.get<{ Params: VehicleAddress }>(
    '/api/vehicles/:id',
    { schema: vehicleAddressSchema, schemaErrorFormatter: unknownVehicleUnlessNumbered },
    async (request): Promise<VehicleDto> => vehicleSheetDto(getVehicle(ports, request.params.id)),
  );
};

export const vehicleRoutes: RouteModule = (server, { ports }) => {
  server.post<{ Params: VehicleAddress; Body: VehicleUpdateRequest }>(
    '/api/vehicles/:id',
    { schema: vehicleUpdateSchema, schemaErrorFormatter: unknownVehicleUnlessNumbered },
    async (request): Promise<VehicleDto> => vehicleSheetDto(updateVehicle(ports, request.params.id, request.body)),
  );

  server.delete<{ Params: VehicleAddress }>(
    '/api/vehicles/:id',
    { schema: vehicleAddressSchema, schemaErrorFormatter: unknownVehicleUnlessNumbered },
    async (request): Promise<OkResponse> => {
      deleteVehicle(ports, request.params.id);
      return OK;
    },
  );
};
