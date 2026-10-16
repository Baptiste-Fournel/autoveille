import { ImapFlow, type ImapFlowOptions } from 'imapflow';
import type { MailboxReader, MailboxSession } from '../../../application/ports/mailboxReader.js';
import type { MailboxSettings } from '../../../domain/settings/types.js';
import { friendlyError } from './friendlyError.js';

const SECURE_IMAP_PORT = 993;

export interface ImapMailboxState {
  readonly uidValidity?: bigint;
  readonly exists?: number;
}

export interface ImapMailboxLock {
  release(): void;
}

export interface ImapMessage {
  readonly source?: Uint8Array;
}

export type ImapSearch = { readonly uid: string } | { readonly since: Date };

export interface ImapClient {
  readonly mailbox: ImapMailboxState | false;
  connect(): Promise<void>;
  getMailboxLock(path: string): Promise<ImapMailboxLock>;
  search(query: ImapSearch, options: { readonly uid: true }): Promise<number[] | false | undefined>;
  fetchOne(
    range: string,
    query: { readonly uid: true; readonly source: true },
    options: { readonly uid: true },
  ): Promise<ImapMessage | false | undefined>;
  logout(): Promise<void>;
}

export type ImapClientFactory = (options: ImapFlowOptions) => ImapClient;

export const imapFlowClient: ImapClientFactory = (options) => new ImapFlow(options);

const connectionOptions = (account: MailboxSettings, connectionTimeoutMs: number | undefined): ImapFlowOptions => ({
  host: account.host,
  port: account.port,
  secure: account.port === SECURE_IMAP_PORT,
  auth: { user: account.user, pass: account.pass },
  logger: false,
  ...(connectionTimeoutMs === undefined ? {} : { connectionTimeout: connectionTimeoutMs }),
});

const ascending = (uids: number[] | false | undefined): readonly number[] => (uids ? [...uids].sort((a, b) => a - b) : []);

const loggedOut = (client: ImapClient): Promise<void> => client.logout().catch(() => undefined);

const searched = (client: ImapClient, query: ImapSearch): Promise<readonly number[]> =>
  client.search(query, { uid: true }).then(ascending, (error: unknown) => {
    throw friendlyError(error);
  });

const sessionOn = async (client: ImapClient, mailboxName: string): Promise<MailboxSession> => {
  const lock = await client.getMailboxLock(mailboxName).catch(async (error: unknown) => {
    await loggedOut(client);
    throw friendlyError(error);
  });
  const { mailbox } = client;
  return {
    uidValidity: mailbox && 'uidValidity' in mailbox ? Number(mailbox.uidValidity) : null,
    messageCount: mailbox && 'exists' in mailbox ? Number(mailbox.exists) : 0,
    uidsAfter: async (uid) => (await searched(client, { uid: `${uid + 1}:*` })).filter((candidate) => candidate > uid),
    uidsSince: (instant) => searched(client, { since: new Date(instant) }),
    read: async (uid) => {
      const message = await client.fetchOne(String(uid), { uid: true, source: true }, { uid: true });
      return message ? message.source : undefined;
    },
    close: async () => {
      lock.release();
      await loggedOut(client);
    },
  };
};

export const imapMailboxReader = (createClient: ImapClientFactory): MailboxReader => ({
  open: async (account, connectionTimeoutMs) => {
    const client = createClient(connectionOptions(account, connectionTimeoutMs));
    await client.connect().catch((error: unknown) => {
      throw friendlyError(error);
    });
    return sessionOn(client, account.mailbox);
  },
});
