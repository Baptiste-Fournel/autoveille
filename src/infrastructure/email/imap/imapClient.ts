import { ImapFlow, type ImapFlowOptions } from 'imapflow';
import type { MailboxSettings } from '../../../domain/settings/types.js';

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

export type ImapEvent = 'exists' | 'close' | 'error';

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
  on(event: ImapEvent, listener: (detail?: unknown) => void): unknown;
}

export type ImapClientFactory = (options: ImapFlowOptions) => ImapClient;

export const imapFlowClient: ImapClientFactory = (options) => new ImapFlow(options);

export const connectionOptions = (account: MailboxSettings, connectionTimeoutMs: number | undefined): ImapFlowOptions => ({
  host: account.host,
  port: account.port,
  secure: account.port === SECURE_IMAP_PORT,
  auth: { user: account.user, pass: account.pass },
  logger: false,
  ...(connectionTimeoutMs === undefined ? {} : { connectionTimeout: connectionTimeoutMs }),
});

export const loggedOut = (client: ImapClient): Promise<void> => client.logout().catch(() => undefined);
