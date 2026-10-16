import type webpush from 'web-push';
import type { WebPushClient } from '../../src/infrastructure/push/webPushChannel.js';

export interface PushServiceDelivery {
  readonly endpoint: string;
  readonly payload: string;
}

export interface SimulatedPushService extends WebPushClient {
  readonly deliveries: () => readonly PushServiceDelivery[];
}

export const simulatedPushService = (): SimulatedPushService => {
  let deliveries: readonly PushServiceDelivery[] = [];
  return {
    sendNotification: async (subscription: webpush.PushSubscription, payload: string) => {
      deliveries = [...deliveries, { endpoint: subscription.endpoint, payload }];
      return { statusCode: 201, body: '', headers: {} };
    },
    deliveries: () => deliveries,
  };
};
