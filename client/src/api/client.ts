import type {
  CheckNowResponse,
  CheckResultDto,
  HttpSiteTestRequest,
  HttpSiteTestResponse,
  LoginRequest,
  MailboxTestRequest,
  MeResponse,
  OkResponse,
  OverviewResponse,
  PushKeyResponse,
  RereadResponse,
  SettingsPreviewResponse,
  SettingsRequest,
  SettingsResponse,
  SettingsUpdateResponse,
  SetupRequest,
  SourcesResponse,
  SubscribeRequest,
  SubscribeResponse,
  TelegramTestRequest,
  TemplatePreviewRequest,
  TemplatePreviewResponse,
  VehicleDto,
  VehiclesQuery,
  VehiclesResponse,
  VehicleUpdateRequest,
} from '../../../src/shared/api';
import type { Http, Revalidation } from './http';

export interface ApiClient {
  readonly me: () => Promise<MeResponse>;
  readonly setup: (request: SetupRequest) => Promise<OkResponse>;
  readonly login: (request: LoginRequest) => Promise<OkResponse>;
  readonly overviewIfChanged: (etag: string | null) => Promise<Revalidation<OverviewResponse>>;
  readonly vehicles: (query: VehiclesQuery) => Promise<VehiclesResponse>;
  readonly vehiclesIfChanged: (query: VehiclesQuery, etag: string | null) => Promise<Revalidation<VehiclesResponse>>;
  readonly vehicleIfChanged: (id: number, etag: string | null) => Promise<Revalidation<VehicleDto>>;
  readonly updateVehicle: (id: number, request: VehicleUpdateRequest) => Promise<VehicleDto>;
  readonly deleteVehicle: (id: number) => Promise<OkResponse>;
  readonly settings: () => Promise<SettingsResponse>;
  readonly saveSettings: (settings: SettingsRequest) => Promise<SettingsUpdateResponse>;
  readonly previewSettings: (settings: SettingsRequest) => Promise<SettingsPreviewResponse>;
  readonly previewTemplate: (request: TemplatePreviewRequest) => Promise<TemplatePreviewResponse>;
  readonly sources: () => Promise<SourcesResponse>;
  readonly testMailbox: (request: MailboxTestRequest) => Promise<CheckResultDto>;
  readonly testHttpSite: (request: HttpSiteTestRequest) => Promise<HttpSiteTestResponse>;
  readonly checkNow: () => Promise<CheckNowResponse>;
  readonly reread: () => Promise<RereadResponse>;
  readonly pushKey: () => Promise<PushKeyResponse>;
  readonly subscribePush: (request: SubscribeRequest) => Promise<SubscribeResponse>;
  readonly testPush: () => Promise<CheckResultDto>;
  readonly testTelegram: (request: TelegramTestRequest) => Promise<CheckResultDto>;
}

const vehiclesAddress = (query: VehiclesQuery): string => {
  const parameters = new URLSearchParams();
  for (const [name, value] of [
    ['status', query.status],
    ['kind', query.kind],
    ['days', query.days],
    ['cursor', query.cursor],
    ['limit', query.limit],
  ] as const) {
    if (value !== undefined) {
      parameters.set(name, String(value));
    }
  }
  const search = parameters.toString();
  return search === '' ? '/api/vehicles' : `/api/vehicles?${search}`;
};

const vehicleAddress = (id: number): string => `/api/vehicles/${id}`;

export const createApiClient = (http: Http): ApiClient => ({
  me: () => http.send('GET', '/api/me'),
  setup: (request) => http.send('POST', '/api/setup', request),
  login: (request) => http.send('POST', '/api/login', request),
  overviewIfChanged: (etag) => http.revalidate('/api/overview', etag),
  vehicles: (query) => http.send('GET', vehiclesAddress(query)),
  vehiclesIfChanged: (query, etag) => http.revalidate(vehiclesAddress(query), etag),
  vehicleIfChanged: (id, etag) => http.revalidate(vehicleAddress(id), etag),
  updateVehicle: (id, request) => http.send('POST', vehicleAddress(id), request),
  deleteVehicle: (id) => http.send('DELETE', vehicleAddress(id)),
  settings: () => http.send('GET', '/api/settings'),
  saveSettings: (settings) => http.send('PUT', '/api/settings', settings),
  previewSettings: (settings) => http.send('POST', '/api/settings/preview', settings),
  previewTemplate: (request) => http.send('POST', '/api/templates/preview', request),
  sources: () => http.send('GET', '/api/sources'),
  testMailbox: (request) => http.send('POST', '/api/sources/imap/test', request),
  testHttpSite: (request) => http.send('POST', '/api/sources/http/test', request),
  checkNow: () => http.send('POST', '/api/sources/check-now'),
  reread: () => http.send('POST', '/api/sources/reread'),
  pushKey: () => http.send('GET', '/api/push/key'),
  subscribePush: (request) => http.send('POST', '/api/push/subscribe', request),
  testPush: () => http.send('POST', '/api/push/test'),
  testTelegram: (request) => http.send('POST', '/api/telegram/test', request),
});
