import { sendTestPush } from '../../../application/notifications/sendTestPush.js';
import { sendTestTelegram } from '../../../application/notifications/sendTestTelegram.js';
import { pushPublicKey, subscribe, unsubscribe } from '../../../application/notifications/subscriptions.js';
import type {
  CheckResultDto,
  OkResponse,
  PushKeyResponse,
  SubscribeRequest,
  SubscribeResponse,
  TelegramTestRequest,
  UnsubscribeRequest,
} from '../../../shared/api.js';
import { checkResultDto } from '../dto/checkResult.js';
import { enteredTelegramChatOf, pushKeyDto, subscribedDto } from '../dto/notifications.js';
import { OK } from '../dto/ok.js';
import { INVALID_SUBSCRIPTION_TEXT, rejectedAs } from '../errors.js';
import type { RouteModule } from '../routeModule.js';
import { subscribeSchema, telegramTestSchema, unsubscribeSchema } from '../schemas/notifications.js';

export const notificationRoutes: RouteModule = (server, { ports }) => {
  server.get('/api/push/key', async (): Promise<PushKeyResponse> => pushKeyDto(pushPublicKey(ports)));

  server.post<{ Body: SubscribeRequest }>(
    '/api/push/subscribe',
    { schema: subscribeSchema, schemaErrorFormatter: rejectedAs(INVALID_SUBSCRIPTION_TEXT) },
    async (request): Promise<SubscribeResponse> => subscribedDto(subscribe(ports, request.body.subscription)),
  );

  server.post<{ Body: UnsubscribeRequest }>(
    '/api/push/unsubscribe',
    { schema: unsubscribeSchema },
    async (request): Promise<OkResponse> => {
      unsubscribe(ports, request.body.endpoint);
      return OK;
    },
  );

  server.post('/api/push/test', async (): Promise<CheckResultDto> => checkResultDto(await sendTestPush(ports)));

  server.post<{ Body: TelegramTestRequest }>(
    '/api/telegram/test',
    { schema: telegramTestSchema },
    async (request): Promise<CheckResultDto> => checkResultDto(await sendTestTelegram(ports, enteredTelegramChatOf(request.body))),
  );
};
