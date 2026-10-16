import { overview } from '../../../application/overview/overview.js';
import type { OverviewResponse } from '../../../shared/api.js';
import { overviewDto } from '../dto/overview.js';
import type { RouteModule } from '../routeModule.js';

export const overviewRoutes: RouteModule = (server, { ports }) => {
  server.get('/api/overview', async (): Promise<OverviewResponse> => overviewDto(overview(ports)));
};
