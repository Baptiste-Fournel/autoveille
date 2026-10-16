import { getSettings } from '../../../application/settings/getSettings.js';
import { checkNow } from '../../../application/sources/checkNow.js';
import { sourcesOverview } from '../../../application/sources/sourcesOverview.js';
import { testHttpSite } from '../../../application/sources/testHttpSite.js';
import { testMailbox } from '../../../application/sources/testMailbox.js';
import type {
  CheckNowResponse,
  CheckResultDto,
  HttpSiteTestRequest,
  HttpSiteTestResponse,
  MailboxTestRequest,
  RereadResponse,
  SourcesResponse,
} from '../../../shared/api.js';
import { checkResultDto } from '../dto/checkResult.js';
import { mailboxFormOf } from '../dto/maskedSecrets.js';
import { checkNowDto, httpSiteTestDto, rereadDto, sourcesDto } from '../dto/sources.js';
import type { RouteModule } from '../routeModule.js';
import { httpSiteTestSchema, mailboxTestSchema } from '../schemas/sources.js';

export const sourceRoutes: RouteModule = (server, { ports, sources }) => {
  server.get('/api/sources', async (): Promise<SourcesResponse> => sourcesDto(sourcesOverview(ports)));

  server.post<{ Body: MailboxTestRequest }>(
    '/api/sources/imap/test',
    { schema: mailboxTestSchema },
    async (request): Promise<CheckResultDto> => checkResultDto(await testMailbox(ports, mailboxFormOf(request.body, getSettings(ports)))),
  );

  server.post<{ Body: HttpSiteTestRequest }>(
    '/api/sources/http/test',
    { schema: httpSiteTestSchema },
    async (request): Promise<HttpSiteTestResponse> => httpSiteTestDto(await testHttpSite(ports, request.body.url ?? '')),
  );

  server.post('/api/sources/check-now', async (): Promise<CheckNowResponse> => checkNowDto(await checkNow(sources)));

  server.post('/api/sources/reread', async (): Promise<RereadResponse> => rereadDto(await sources.mailbox.rereadAll()));
};
