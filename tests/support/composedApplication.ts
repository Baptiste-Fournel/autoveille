import { fileURLToPath } from 'node:url';
import { loadConfig } from '../../src/infrastructure/config/loadConfig.js';
import type { ImapClientFactory } from '../../src/infrastructure/email/imap/imapMailboxReader.js';
import type { WebPushClient } from '../../src/infrastructure/push/webPushChannel.js';
import { type Application, buildApplication } from '../../src/main.js';
import { type FakeClock, fakeClock } from '../fakes/fakeClock.js';
import { type ManualTimers, manualTimers } from './manualTimers.js';
import { simulatedImapClient } from './simulatedImapClient.js';
import { simulatedWeb } from './simulatedWeb.js';

export const LEGACY_PUBLIC_DIRECTORY = fileURLToPath(new URL('../../public/', import.meta.url));

export interface ComposedApplication extends Application {
  readonly clock: FakeClock;
  readonly timers: ManualTimers;
}

export interface ComposedApplicationOptions {
  readonly environment?: Readonly<Record<string, string>>;
  readonly databaseFile?: string;
  readonly fetch?: typeof fetch;
  readonly imapClient?: ImapClientFactory;
  readonly webPush?: WebPushClient;
  readonly staticDirectory?: string;
}

const silentPushService: WebPushClient = { sendNotification: async () => ({}) };

export const composedApplication = async (options: ComposedApplicationOptions = {}): Promise<ComposedApplication> => {
  const clock = fakeClock();
  const timers = manualTimers();
  const application = await buildApplication({
    config: loadConfig({ environment: options.environment ?? {}, dotEnv: '', workingDirectory: '/srv/autoveille' }),
    databaseFile: options.databaseFile ?? ':memory:',
    staticDirectory: options.staticDirectory ?? LEGACY_PUBLIC_DIRECTORY,
    clock,
    fetch: options.fetch ?? simulatedWeb({}).fetch,
    imapClient: options.imapClient ?? simulatedImapClient().createClient,
    webPush: options.webPush ?? silentPushService,
    timers,
    logging: false,
  });
  return { ...application, clock, timers };
};
