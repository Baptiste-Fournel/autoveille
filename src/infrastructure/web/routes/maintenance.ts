import { repairVehicles } from '../../../application/ingest/repairVehicles.js';
import type { RepairResponse } from '../../../shared/api.js';
import { repairDto } from '../dto/maintenance.js';
import type { RouteModule } from '../routeModule.js';

export const maintenanceRoutes: RouteModule = (server, { ports }) => {
  server.post('/api/maintenance/repair', async (): Promise<RepairResponse> => repairDto(await repairVehicles(ports)));
};
