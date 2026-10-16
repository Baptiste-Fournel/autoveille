import { importToken } from '../../../application/auth/importToken.js';
import { importListings } from '../../../application/ingest/importListings.js';
import { recordPublishedDates } from '../../../application/ingest/recordPublishedDates.js';
import type {
  ImportRequest,
  ImportResponse,
  ImportTokenResponse,
  PublishedDatesRequest,
  PublishedDatesResponse,
} from '../../../shared/api.js';
import { importListingsRequestOf, importSummaryDto, importTokenDto, publishedDatesOf, publishedDatesSummaryDto } from '../dto/import.js';
import { NO_DATE_TO_RECORD_TEXT, NOTHING_TO_IMPORT_TEXT, rejectedAs } from '../errors.js';
import { importTokenChecked } from '../importTokenCheck.js';
import type { RouteModule } from '../routeModule.js';
import { importSchema, publishedDatesSchema } from '../schemas/import.js';

export const importRoutes: RouteModule = (server, { ports }) => {
  const tokenChecked = importTokenChecked(ports);

  server.get('/api/import/token', async (): Promise<ImportTokenResponse> => importTokenDto(importToken(ports)));

  server.post<{ Body: ImportRequest }>(
    '/api/import',
    { schema: importSchema, schemaErrorFormatter: rejectedAs(NOTHING_TO_IMPORT_TEXT), preValidation: tokenChecked },
    async (request): Promise<ImportResponse> => importSummaryDto(await importListings(ports, importListingsRequestOf(request.body))),
  );

  server.post<{ Body: PublishedDatesRequest }>(
    '/api/import/dates',
    { schema: publishedDatesSchema, schemaErrorFormatter: rejectedAs(NO_DATE_TO_RECORD_TEXT), preValidation: tokenChecked },
    async (request): Promise<PublishedDatesResponse> =>
      publishedDatesSummaryDto(recordPublishedDates(ports, publishedDatesOf(request.body))),
  );
};
