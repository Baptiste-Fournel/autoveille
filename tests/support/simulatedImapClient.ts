import type { ImapFlowOptions } from 'imapflow';
import type { ImapClient, ImapClientFactory, ImapMailboxState, ImapSearch } from '../../src/infrastructure/email/imap/imapMailboxReader.js';

export interface StoredImapMessage {
  readonly uid: number;
  readonly receivedAt: string;
  readonly source?: string;
}

export interface SimulatedImapServer {
  readonly uidValidity?: bigint;
  readonly messages?: readonly StoredImapMessage[];
  readonly connectFailure?: Error;
  readonly lockFailure?: Error;
  readonly searchFailure?: Error;
  readonly logoutFailure?: Error;
}

export interface SimulatedImapClient {
  readonly createClient: ImapClientFactory;
  readonly connections: () => readonly ImapFlowOptions[];
  readonly lockedMailboxes: () => readonly string[];
  readonly searches: () => readonly ImapSearch[];
  readonly steps: () => readonly string[];
}

const DAY_LENGTH = 'YYYY-MM-DD'.length;

const highestUid = (messages: readonly StoredImapMessage[]): number => Math.max(0, ...messages.map((message) => message.uid));

const uidsInRange = (messages: readonly StoredImapMessage[], range: string): number[] => {
  const from = Number(range.split(':')[0]);
  const inRange = messages.filter((message) => message.uid >= from).map((message) => message.uid);
  return inRange.length > 0 || messages.length === 0 ? inRange : [highestUid(messages)];
};

const uidsReceivedSince = (messages: readonly StoredImapMessage[], since: Date): number[] =>
  messages
    .filter((message) => message.receivedAt.slice(0, DAY_LENGTH) >= since.toISOString().slice(0, DAY_LENGTH))
    .map((message) => message.uid);

export const simulatedImapClient = (server: SimulatedImapServer = {}): SimulatedImapClient => {
  const messages = server.messages ?? [];
  const connections: ImapFlowOptions[] = [];
  const lockedMailboxes: string[] = [];
  const searches: ImapSearch[] = [];
  const steps: string[] = [];
  const createClient: ImapClientFactory = (options) => {
    connections.push(options);
    let mailbox: ImapMailboxState | false = false;
    const client: ImapClient = {
      get mailbox() {
        return mailbox;
      },
      connect: async () => {
        steps.push('connect');
        if (server.connectFailure) {
          throw server.connectFailure;
        }
      },
      getMailboxLock: async (path) => {
        steps.push(`lock ${path}`);
        if (server.lockFailure) {
          throw server.lockFailure;
        }
        lockedMailboxes.push(path);
        mailbox =
          server.uidValidity === undefined ? { exists: messages.length } : { uidValidity: server.uidValidity, exists: messages.length };
        return { release: () => steps.push(`release ${path}`) };
      },
      search: async (query) => {
        searches.push(query);
        if (server.searchFailure) {
          throw server.searchFailure;
        }
        return 'uid' in query ? uidsInRange(messages, query.uid) : uidsReceivedSince(messages, query.since);
      },
      fetchOne: async (range) => {
        const message = messages.find((candidate) => String(candidate.uid) === range);
        if (message === undefined) {
          return false;
        }
        return message.source === undefined ? {} : { source: Buffer.from(message.source) };
      },
      logout: async () => {
        steps.push('logout');
        if (server.logoutFailure) {
          throw server.logoutFailure;
        }
      },
    };
    return client;
  };
  return {
    createClient,
    connections: () => connections,
    lockedMailboxes: () => lockedMailboxes,
    searches: () => searches,
    steps: () => steps,
  };
};
