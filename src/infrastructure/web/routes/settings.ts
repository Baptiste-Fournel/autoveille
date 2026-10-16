import { getSettings } from '../../../application/settings/getSettings.js';
import { previewSettings } from '../../../application/settings/previewSettings.js';
import { updateSettings } from '../../../application/settings/updateSettings.js';
import type { SettingsPreviewResponse, SettingsRequest, SettingsResponse, SettingsUpdateResponse } from '../../../shared/api.js';
import { withStoredSecrets } from '../dto/maskedSecrets.js';
import { settingsPreviewDto, settingsResponseDto, settingsUpdateDto } from '../dto/settings.js';
import { replyWithRefusedPreview } from '../errors.js';
import type { RouteModule } from '../routeModule.js';
import { previewSettingsSchema, updateSettingsSchema } from '../schemas/settings.js';

export const settingsRoutes: RouteModule = (server, { ports }) => {
  server.get('/api/settings', async (): Promise<SettingsResponse> => settingsResponseDto(getSettings(ports)));

  server.put<{ Body: SettingsRequest }>(
    '/api/settings',
    { schema: updateSettingsSchema },
    async (request): Promise<SettingsUpdateResponse> =>
      settingsUpdateDto(await updateSettings(ports, withStoredSecrets(request.body, getSettings(ports)))),
  );

  server.post<{ Body: SettingsRequest }>(
    '/api/settings/preview',
    { schema: previewSettingsSchema, errorHandler: replyWithRefusedPreview },
    async (request): Promise<SettingsPreviewResponse> =>
      settingsPreviewDto(await previewSettings(ports, withStoredSecrets(request.body, getSettings(ports)))),
  );
};
