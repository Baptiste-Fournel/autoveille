import { onTestFinished } from 'vitest';
import type { SettingsDto, SettingsResponse, SubscribeRequest } from '../../src/shared/api.js';
import { OWNER_PASSWORD, PHONE_ADDRESS, SESSION_COOKIE, SETUP_CODE } from './authentication.js';
import { type ComposedApplication, composedApplication } from './composedApplication.js';
import { type DealerInbox, dealerInbox } from './dealerInbox.js';
import { DEALER_MAILBOX } from './dealerMailbox.js';
import { type SimulatedPushService, simulatedPushService } from './simulatedPushService.js';

const CADDY_ON_THE_SAME_MACHINE = '127.0.0.1';

export const DEALER = {
  firstName: 'Camille',
  lastName: 'Durand',
  company: 'Démo Automobiles',
  city: 'Bordeaux',
  phone: '06 39 98 12 34',
} as const;

export const PHONE_SUBSCRIPTION: SubscribeRequest['subscription'] = {
  endpoint: 'https://fcm.googleapis.com/fcm/send/eJ4lXq0dVlo:APA91bH-concession',
  expirationTime: null,
  keys: {
    p256dh: 'BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QTpQtUbVlUls0VJXg7A8u-Ts1XbjhazAkj7I99e8QcYP7DkM',
    auth: 'tBHItJI5svbpez7KI4CCXg',
  },
};

export interface Answer<Body> {
  readonly status: number;
  readonly body: Body;
}

type Method = 'GET' | 'POST' | 'PUT' | 'DELETE';

export interface Connection {
  readonly remoteAddress: string;
  readonly headers: Readonly<Record<string, string>>;
}

export const FROM_THE_PHONE: Connection = { remoteAddress: PHONE_ADDRESS, headers: {} };

export const throughCaddy = (host: string): Connection => ({
  remoteAddress: CADDY_ON_THE_SAME_MACHINE,
  headers: { host, 'x-forwarded-proto': 'https', 'x-forwarded-for': PHONE_ADDRESS },
});

export interface DealershipOptions {
  readonly environment?: Readonly<Record<string, string>>;
  readonly connection?: Connection;
}

export interface Phone {
  readonly request: <Body>(method: Method, url: string, payload?: object) => Promise<Answer<Body>>;
}

export interface Dealership {
  readonly application: ComposedApplication;
  readonly inbox: DealerInbox;
  readonly pushService: SimulatedPushService;
  readonly phone: Phone;
}

export interface PushedNotification {
  readonly title: string;
  readonly body: string;
  readonly url: string;
  readonly vehicleId?: number;
}

export const phoneOf = (application: ComposedApplication, connection: Connection = FROM_THE_PHONE): Phone => {
  let cookie: string | undefined;
  return {
    request: async <Body>(method: Method, url: string, payload?: object): Promise<Answer<Body>> => {
      const response = await application.server.inject({
        method,
        url,
        remoteAddress: connection.remoteAddress,
        headers: cookie === undefined ? connection.headers : { ...connection.headers, cookie },
        ...(payload === undefined ? {} : { payload }),
      });
      const sessionCookie = response.cookies.find((candidate) => candidate.name === SESSION_COOKIE);
      if (sessionCookie !== undefined) {
        cookie = sessionCookie.value === '' ? undefined : `${SESSION_COOKIE}=${sessionCookie.value}`;
      }
      return { status: response.statusCode, body: response.json<Body>() };
    },
  };
};

export const openDealership = async (options: DealershipOptions = {}): Promise<Dealership> => {
  const inbox = dealerInbox();
  const pushService = simulatedPushService();
  const application = await composedApplication({
    environment: options.environment ?? { SETUP_CODE },
    imapClient: inbox.createClient,
    webPush: pushService,
  });
  onTestFinished(() => application.stop());
  await application.start();
  return { application, inbox, pushService, phone: phoneOf(application, options.connection) };
};

export const savedSettings = async (phone: Phone, change: (settings: SettingsDto) => SettingsDto): Promise<SettingsDto> => {
  const { body } = await phone.request<SettingsResponse>('GET', '/api/settings');
  const saved = await phone.request<SettingsResponse>('PUT', '/api/settings', change(body.settings));
  if (saved.status !== 200) {
    throw new Error(`Réglages refusés (${saved.status}) : ${JSON.stringify(saved.body)}`);
  }
  return saved.body.settings;
};

export const setUpDealership = async (options: DealershipOptions = {}): Promise<Dealership> => {
  const dealership = await openDealership(options);
  const { phone } = dealership;
  await phone.request('POST', '/api/setup', { setupCode: SETUP_CODE, password: OWNER_PASSWORD });
  await savedSettings(phone, (settings) => ({ ...settings, dealer: DEALER, imap: DEALER_MAILBOX }));
  await phone.request('POST', '/api/push/subscribe', { subscription: PHONE_SUBSCRIPTION });
  return dealership;
};

export const notificationsReceived = (pushService: SimulatedPushService): readonly PushedNotification[] =>
  pushService.deliveries().map((delivery) => {
    const notification: PushedNotification = JSON.parse(delivery.payload);
    return notification;
  });
