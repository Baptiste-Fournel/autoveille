import { previewTemplate } from '../../../application/settings/previewTemplate.js';
import type { TemplatePreviewRequest, TemplatePreviewResponse } from '../../../shared/api.js';
import { templatePreviewDto } from '../dto/templates.js';
import type { RouteModule } from '../routeModule.js';
import { templatePreviewSchema } from '../schemas/templates.js';

export const templateRoutes: RouteModule = (server, { ports }) => {
  server.post<{ Body: TemplatePreviewRequest }>(
    '/api/templates/preview',
    { schema: templatePreviewSchema },
    async (request): Promise<TemplatePreviewResponse> => templatePreviewDto(previewTemplate(ports, request.body)),
  );
};
