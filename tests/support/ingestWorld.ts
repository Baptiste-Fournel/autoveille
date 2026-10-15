import { type IngestDependencies, type IngestOutcome, ingestListing } from '../../src/application/ingest/ingestListing.js';
import type { PushSubscription } from '../../src/application/ports/pushSubscriptionRepository.js';
import type { Settings } from '../../src/domain/settings/types.js';
import type { RawListing } from '../../src/domain/vehicle/types.js';
import { FAKE_NOW, type FakeClock, fakeClock } from '../fakes/fakeClock.js';
import { type FakeGeocoder, fakeGeocoder } from '../fakes/fakeGeocoder.js';
import { type FakeNotificationChannel, type FakeNotificationOptions, fakeNotificationChannel } from '../fakes/fakeNotificationChannel.js';
import { type FakePersistence, fakePersistence } from '../fakes/fakePersistence.js';
import { FAKE_PUSH_KEYS } from '../fakes/fakePushKeyGenerator.js';

export const PUBLIC_ADDRESS = 'https://veille.garage-du-lac.fr';

export const DEALER_PHONE: PushSubscription = {
  endpoint: 'https://fcm.googleapis.com/fcm/send/eHk3YmZ0aW9uLmdhcmFnZS1kdS1sYWM',
  expirationTime: null,
  keys: {
    p256dh: 'BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QTpQtUbVlUls0VJXg7A8u-Ts1XbjhazAkj7I99e8QcYP7DkM',
    auth: 'tBHItJI5svbpez7KI4CCXg',
  },
};

export const DEALER_TABLET: PushSubscription = {
  endpoint: 'https://web.push.apple.com/QGuQyavXutnMH8PvP1R3S8ozvqYtablette',
  expirationTime: null,
  keys: {
    p256dh: 'BOr5jzfZ3XWWfRKxUXbWr8D9w6P1M4AxKSu8l7pMyXbKZp2sYiGRHk8hPbcIDuWzNJcObp7kZhhkDLNO5fmP8Nw',
    auth: 'Zm9vYmFyYmF6cXV4MTIzNA',
  },
};

export interface IngestWorld extends FakePersistence {
  readonly dependencies: IngestDependencies;
  readonly channel: FakeNotificationChannel;
  readonly geocoder: FakeGeocoder;
  readonly clock: FakeClock;
}

export interface IngestWorldOptions {
  readonly settings?: Settings;
  readonly channel?: FakeNotificationOptions;
  readonly devices?: readonly PushSubscription[];
  readonly pushKeys?: boolean;
}

export const ingestWorld = (options: IngestWorldOptions = {}): IngestWorld => {
  const persistence = fakePersistence();
  if (options.settings !== undefined) {
    persistence.settings.save(options.settings);
  }
  if (options.pushKeys !== false) {
    persistence.secrets.set('vapid_public', FAKE_PUSH_KEYS.publicKey);
    persistence.secrets.set('vapid_private', FAKE_PUSH_KEYS.privateKey);
  }
  for (const device of options.devices ?? [DEALER_PHONE]) {
    persistence.pushSubscriptions.save(device, FAKE_NOW);
  }
  const channel = fakeNotificationChannel(options.channel);
  const geocoder = fakeGeocoder();
  const clock = fakeClock();
  return {
    ...persistence,
    channel,
    geocoder,
    clock,
    dependencies: {
      vehicles: persistence.vehicles,
      settings: persistence.settings,
      secrets: persistence.secrets,
      subscriptions: persistence.pushSubscriptions,
      channel,
      address: { configuredBaseUrl: PUBLIC_ADDRESS, port: 3000 },
      transaction: persistence.transaction,
      geocoder,
      clock,
    },
  };
};

export const ingest = (world: IngestWorld, listing: RawListing): Promise<IngestOutcome> =>
  ingestListing(world.dependencies, { listing, settings: world.settings.load(), notify: true });
