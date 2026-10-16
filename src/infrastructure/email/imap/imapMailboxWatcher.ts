import type { Logger } from '../../../application/ports/logger.js';
import type { SettingsRepository } from '../../../application/ports/settingsRepository.js';
import { MAILBOX_WATCH_CLOSED, mailboxWatchListeningLog, mailboxWatchRetryLog } from '../../../domain/presentation/mailbox.js';
import { isMailboxReadable } from '../../../domain/settings/mailboxConfigured.js';
import type { MailboxSettings } from '../../../domain/settings/types.js';
import { connectionOptions, type ImapClient, type ImapClientFactory, loggedOut } from './imapClient.js';
import { imapFailureReason } from './imapFailureReason.js';

const FIRST_RETRY_DELAY_MS = 5_000;

const LONGEST_RETRY_DELAY_MS = 300_000;

const STABLE_CONNECTION_MS = 60_000;

export interface RetryTimers<Handle> {
  readonly setTimeout: (task: () => void, delayMs: number) => Handle;
  readonly clearTimeout: (handle: Handle) => void;
}

export interface MailboxWatchDependencies<Handle> {
  readonly createClient: ImapClientFactory;
  readonly timers: RetryTimers<Handle>;
  readonly settings: Pick<SettingsRepository, 'load'>;
  readonly readMailbox: () => void;
  readonly logger: Logger;
}

export interface MailboxWatch {
  readonly start: () => void;
  readonly settingsSaved: () => void;
  readonly stop: () => Promise<void>;
}

const sameAccount = (left: MailboxSettings | undefined, right: MailboxSettings | undefined): boolean =>
  left === undefined || right === undefined
    ? left === right
    : left.host === right.host &&
      left.port === right.port &&
      left.user === right.user &&
      left.pass === right.pass &&
      left.mailbox === right.mailbox;

const selectMailbox = async (client: ImapClient, mailbox: string): Promise<void> => {
  await client.connect();
  const lock = await client.getMailboxLock(mailbox);
  lock.release();
};

export const imapMailboxWatcher = <Handle>({
  createClient,
  timers,
  settings,
  readMailbox,
  logger,
}: MailboxWatchDependencies<Handle>): MailboxWatch => {
  let running = false;
  let watchedAccount: MailboxSettings | undefined;
  let openClient: ImapClient | undefined;
  let retry: Handle | undefined;
  let stableConnection: Handle | undefined;
  let retryDelayMs = FIRST_RETRY_DELAY_MS;

  const readableAccount = (): MailboxSettings | undefined => {
    const { imap } = settings.load();
    return isMailboxReadable(imap) ? imap : undefined;
  };

  const cancelled = (handle: Handle | undefined): undefined => {
    if (handle !== undefined) {
      timers.clearTimeout(handle);
    }
    return undefined;
  };

  const cancelPendingTimers = (): void => {
    retry = cancelled(retry);
    stableConnection = cancelled(stableConnection);
  };

  const closeConnection = (): Promise<void> => {
    const leaving = openClient;
    openClient = undefined;
    return leaving === undefined ? Promise.resolve() : loggedOut(leaving);
  };

  const retryLater = (reason: string): void => {
    logger.info(mailboxWatchRetryLog(reason, retryDelayMs));
    retry = timers.setTimeout(() => {
      retry = undefined;
      watchConfiguredMailbox();
    }, retryDelayMs);
    retryDelayMs = Math.min(retryDelayMs * 2, LONGEST_RETRY_DELAY_MS);
  };

  const listening = (mailbox: string): void => {
    stableConnection = timers.setTimeout(() => {
      stableConnection = undefined;
      retryDelayMs = FIRST_RETRY_DELAY_MS;
    }, STABLE_CONNECTION_MS);
    logger.info(mailboxWatchListeningLog(mailbox));
    readMailbox();
  };

  const watch = (account: MailboxSettings): void => {
    const client = createClient(connectionOptions(account, undefined));
    openClient = client;
    const lost = (reason: string): void => {
      if (openClient === client) {
        openClient = undefined;
        stableConnection = cancelled(stableConnection);
        retryLater(reason);
      }
    };
    client.on('exists', () => {
      if (openClient === client) {
        readMailbox();
      }
    });
    client.on('close', () => lost(MAILBOX_WATCH_CLOSED));
    client.on('error', (error) => lost(imapFailureReason(error)));
    void selectMailbox(client, account.mailbox).then(
      () => {
        if (openClient === client) {
          listening(account.mailbox);
        }
      },
      (error: unknown) => {
        lost(imapFailureReason(error));
        return loggedOut(client);
      },
    );
  };

  const watchConfiguredMailbox = (): void => {
    watchedAccount = readableAccount();
    if (watchedAccount !== undefined) {
      watch(watchedAccount);
    }
  };

  return {
    start: () => {
      running = true;
      watchConfiguredMailbox();
    },
    settingsSaved: () => {
      if (!running || sameAccount(watchedAccount, readableAccount())) {
        return;
      }
      cancelPendingTimers();
      void closeConnection();
      retryDelayMs = FIRST_RETRY_DELAY_MS;
      watchConfiguredMailbox();
    },
    stop: async () => {
      running = false;
      cancelPendingTimers();
      await closeConnection();
    },
  };
};
