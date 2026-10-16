import type { HealthResponse } from '../../../shared/api.js';
import { HEALTHY } from '../dto/health.js';
import type { RouteModule } from '../routeModule.js';

export const healthRoutes: RouteModule = (server) => {
  server.get('/api/health', async (): Promise<HealthResponse> => HEALTHY);
};
