import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { FastifyInstance } from 'fastify';
import webpush from 'web-push';
import { accessStatus } from './application/auth/accessStatus.js';
import { createAttemptLimiter } from './application/auth/attemptLimiter.js';
import { ensureSecrets } from './application/auth/ensureSecrets.js';
import { deleteExpiredSessions } from './application/auth/session.js';
import { hasNoRecentVehicle, seedDemo } from './application/ingest/seedDemo.js';
import { publicAddress } from './application/notifications/publicAddress.js';
import type { Clock } from './application/ports/clock.js';
import type { Logger } from './application/ports/logger.js';
import type { SettingsRepository } from './application/ports/settingsRepository.js';
import { errorMessage } from './application/sources/errorMessage.js';
import { httpSitesFetching } from './application/sources/fetchHttpSites.js';
import { mailboxPolling } from './application/sources/pollMailbox.js';
import type { AlertEmailReadingDependencies } from './application/sources/readAlertEmail.js';
import { mailboxWatchReadFailedLog } from './domain/presentation/mailbox.js';
import { DEMO_LOADED_TEXT, firstSignInText, scheduledPassFailedLog, sessionCleanupFailedLog } from './domain/presentation/startup.js';
import { readDotEnvFile } from './infrastructure/config/dotEnv.js';
import { type Config, loadConfig } from './infrastructure/config/loadConfig.js';
import { type ImapClientFactory, imapFlowClient } from './infrastructure/email/imap/imapClient.js';
import { imapMailboxReader } from './infrastructure/email/imap/imapMailboxReader.js';
import { imapMailboxWatcher } from './infrastructure/email/imap/imapMailboxWatcher.js';
import { cheerioListingExtractor } from './infrastructure/extraction/cheerioListingExtractor.js';
import { fetchRedirectResolver } from './infrastructure/http/fetchRedirectResolver.js';
import { fetchSiteFetcher } from './infrastructure/http/fetchSiteFetcher.js';
import { geoApiGouvGeocoder } from './infrastructure/http/geoApiGouvGeocoder.js';
import { telegramChannel } from './infrastructure/http/telegramChannel.js';
import { openDatabase } from './infrastructure/persistence/sqlite/connection.js';
import { migrate } from './infrastructure/persistence/sqlite/migrate.js';
import { SqliteGeoCache } from './infrastructure/persistence/sqlite/sqliteGeoCache.js';
import { SqliteMailboxStateRepository } from './infrastructure/persistence/sqlite/sqliteMailboxStateRepository.js';
import { SqlitePushSubscriptionRepository } from './infrastructure/persistence/sqlite/sqlitePushSubscriptionRepository.js';
import { SqliteSecretStore } from './infrastructure/persistence/sqlite/sqliteSecretStore.js';
import { SqliteSessionRepository } from './infrastructure/persistence/sqlite/sqliteSessionRepository.js';
import { SqliteSettingsRepository } from './infrastructure/persistence/sqlite/sqliteSettingsRepository.js';
import { SqliteSourceRunRepository } from './infrastructure/persistence/sqlite/sqliteSourceRunRepository.js';
import { sqliteTransaction } from './infrastructure/persistence/sqlite/sqliteTransaction.js';
import { SqliteVehicleRepository } from './infrastructure/persistence/sqlite/sqliteVehicleRepository.js';
import { vapidSubject } from './infrastructure/push/vapidSubject.js';
import { type WebPushClient, webPushChannel } from './infrastructure/push/webPushChannel.js';
import { webPushKeyGenerator } from './infrastructure/push/webPushKeyGenerator.js';
import { IntervalScheduler } from './infrastructure/scheduling/intervalScheduler.js';
import { mailboxPollingMinutes } from './infrastructure/scheduling/mailboxPollingMinutes.js';
import { systemTimers, type Timers } from './infrastructure/scheduling/timers.js';
import { cryptoRandom } from './infrastructure/system/cryptoRandom.js';
import { scryptPasswordHasher } from './infrastructure/system/scryptPasswordHasher.js';
import { systemClock } from './infrastructure/system/systemClock.js';
import { createServer } from './infrastructure/web/createServer.js';
import type { ApplicationPorts, PollingSources } from './infrastructure/web/webDependencies.js';

const DATABASE_FILE = 'autoveille.sqlite';

const CLIENT_DIRECTORY = join('dist', 'client');

const SESSION_CLEANUP_INTERVAL_MS = 86_400_000;

export interface Runtime<Handle> {
  readonly clock: Clock;
  readonly fetch: typeof fetch;
  readonly timers: Timers<Handle>;
}

export interface ApplicationEnvironment<Handle> extends Runtime<Handle> {
  readonly config: Config;
  readonly databaseFile: string;
  readonly staticDirectory: string;
  readonly imapClient: ImapClientFactory;
  readonly webPush: WebPushClient;
  readonly logging: boolean;
}

export interface Application {
  readonly server: FastifyInstance;
  readonly ports: ApplicationPorts;
  readonly sources: PollingSources;
  readonly start: () => Promise<void>;
  readonly stop: () => Promise<void>;
}

export const alertEmailReading = <Handle>({ clock, fetch, timers }: Runtime<Handle>): AlertEmailReadingDependencies => ({
  extractor: cheerioListingExtractor(clock),
  redirectResolver: fetchRedirectResolver(fetch, timers),
});

export const buildApplication = async <Handle>(environment: ApplicationEnvironment<Handle>): Promise<Application> => {
  const { config, clock, timers } = environment;
  const database = openDatabase(environment.databaseFile);
  migrate(database, clock);
  const secrets = new SqliteSecretStore(database);
  const { cookieSecret, pushKeys } = ensureSecrets({
    secrets,
    random: cryptoRandom,
    pushKeyGenerator: webPushKeyGenerator,
    passwordHasher: scryptPasswordHasher,
    configuredAppPassword: config.appPassword,
  });
  const storedSettings = new SqliteSettingsRepository(database);
  const logger: Logger = { info: (message) => server.log.info(message) };
  const reportPassFailure = (error: unknown): void => server.log.error(scheduledPassFailedLog(errorMessage(error)));
  const reportWatchedReadFailure = (error: unknown): void => server.log.error(mailboxWatchReadFailedLog(errorMessage(error)));
  const mailboxWatch = imapMailboxWatcher({
    createClient: environment.imapClient,
    timers,
    settings: storedSettings,
    readMailbox: () => void sources.mailbox.pollForNewEmail().catch(reportWatchedReadFailure),
    logger,
  });
  const settings: SettingsRepository = {
    load: () => storedSettings.load(),
    save: (saved) => {
      storedSettings.save(saved);
      mailboxWatch.settingsSaved();
    },
  };
  const address = { configuredBaseUrl: config.baseUrl, port: config.port };
  const pushSubject = (): string => vapidSubject(config.contactEmail, publicAddress(secrets, address));
  const ports: ApplicationPorts = {
    vehicles: new SqliteVehicleRepository(database),
    settings,
    secrets,
    sessions: new SqliteSessionRepository(database),
    subscriptions: new SqlitePushSubscriptionRepository(database),
    sourceRuns: new SqliteSourceRunRepository(database),
    mailboxState: new SqliteMailboxStateRepository(database),
    transaction: sqliteTransaction(database),
    geocoder: geoApiGouvGeocoder(environment.fetch, timers, new SqliteGeoCache(database)),
    clock,
    random: cryptoRandom,
    logger,
    channel: { ...webPushChannel(pushKeys, pushSubject, environment.webPush), ...telegramChannel(environment.fetch) },
    address,
    mailboxReader: imapMailboxReader(environment.imapClient),
    ...alertEmailReading(environment),
    siteFetcher: fetchSiteFetcher(environment.fetch, timers),
    passwordHasher: scryptPasswordHasher,
    pushKeyGenerator: webPushKeyGenerator,
    attempts: createAttemptLimiter(clock),
    configuredSetupCode: config.setupCode,
    configuredBaseUrl: config.baseUrl,
    configuredAppPassword: config.appPassword,
  };
  const sources: PollingSources = { mailbox: mailboxPolling(ports), httpSites: httpSitesFetching(ports) };
  const server = await createServer({
    ports,
    sources,
    cookieSecret,
    staticDirectory: environment.staticDirectory,
    logging: environment.logging,
  });
  const cleanSessions = (): void => {
    try {
      deleteExpiredSessions(ports);
    } catch (error) {
      server.log.error(sessionCleanupFailedLog(errorMessage(error)));
    }
  };
  const scheduler = new IntervalScheduler(sources, timers, reportPassFailure);
  let sessionCleanup: Handle | undefined;
  return {
    server,
    ports,
    sources,
    start: async () => {
      cleanSessions();
      sessionCleanup = timers.setInterval(cleanSessions, SESSION_CLEANUP_INTERVAL_MS);
      if (config.demo && hasNoRecentVehicle(ports)) {
        await seedDemo(ports);
        server.log.info(DEMO_LOADED_TEXT);
      }
      scheduler.start({
        mailboxMinutes: mailboxPollingMinutes(config.imapPollMinutes, config.imapIdle),
        httpSitesMinutes: config.httpPollMinutes,
      });
      if (config.imapIdle) {
        mailboxWatch.start();
      }
    },
    stop: async () => {
      scheduler.stop();
      await mailboxWatch.stop();
      if (sessionCleanup !== undefined) {
        timers.clearInterval(sessionCleanup);
      }
      await server.close();
      database.close();
    },
  };
};

export const readConfig = (): Config =>
  loadConfig({ environment: process.env, dotEnv: readDotEnvFile(resolve('.env')), workingDirectory: process.cwd() });

const systemRuntime = (): Runtime<NodeJS.Timeout> => ({ clock: systemClock, fetch: globalThis.fetch, timers: systemTimers });

export const systemEnvironment = (config: Config, logging: boolean): ApplicationEnvironment<NodeJS.Timeout> => ({
  ...systemRuntime(),
  config,
  databaseFile: join(config.dataDir, DATABASE_FILE),
  staticDirectory: resolve(CLIENT_DIRECTORY),
  imapClient: imapFlowClient,
  webPush: webpush,
  logging,
});

export const systemAlertEmailReading = (): AlertEmailReadingDependencies => alertEmailReading(systemRuntime());

const main = async (): Promise<void> => {
  const config = readConfig();
  const application = await buildApplication(systemEnvironment(config, true));
  await application.start();
  await application.server.listen({ port: config.port, host: config.host });
  if (accessStatus(application.ports, undefined).needsSetup) {
    application.server.log.info(firstSignInText(Boolean(config.setupCode)));
  }
};

if (process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main();
}
