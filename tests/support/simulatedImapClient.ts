import type { ImapFlowOptions } from 'imapflow';
import type {
  ImapClient,
  ImapClientFactory,
  ImapEvent,
  ImapMailboxState,
  ImapSearch,
} from '../../src/infrastructure/email/imap/imapClient.js';

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
  readonly selectionAnswered?: Promise<void>;
  readonly fetchAnswered?: Promise<void>;
  readonly logoutAnswered?: Promise<void>;
}

export interface SimulatedImapClient {
  readonly createClient: ImapClientFactory;
  readonly connections: () => readonly ImapFlowOptions[];
  readonly openConnections: () => readonly ImapFlowOptions[];
  readonly lockedMailboxes: () => readonly string[];
  readonly searches: () => readonly ImapSearch[];
  readonly steps: () => readonly string[];
  readonly receive: (message: StoredImapMessage) => void;
  readonly cutConnections: (failure?: Error) => void;
  readonly refuseConnections: (failure: Error) => void;
  readonly acceptConnections: () => void;
}

interface Listener {
  readonly event: ImapEvent;
  readonly listener: (detail?: unknown) => void;
}

interface SimulatedConnection {
  readonly options: ImapFlowOptions;
  readonly isOpen: () => boolean;
  readonly notifyArrival: (count: number) => void;
  readonly cut: (failure: Error | undefined) => void;
}

const DAY_LENGTH = 'YYYY-MM-DD'.length;

const CONNECTION_NOT_AVAILABLE = 'Connection not available';

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

const afterCurrentWork = (task: () => void): void => {
  setImmediate(task);
};

export const simulatedImapClient = (server: SimulatedImapServer = {}): SimulatedImapClient => {
  let messages = server.messages ?? [];
  let connectFailure = server.connectFailure;
  let created: readonly SimulatedConnection[] = [];
  const lockedMailboxes: string[] = [];
  const searches: ImapSearch[] = [];
  const steps: string[] = [];
  const createClient: ImapClientFactory = (options) => {
    let mailbox: ImapMailboxState | false = false;
    let state: 'new' | 'open' | 'closed' = 'new';
    let listeners: readonly Listener[] = [];
    const emit = (event: ImapEvent, detail?: unknown): void => {
      for (const entry of listeners.filter((candidate) => candidate.event === event)) {
        entry.listener(detail);
      }
    };
    const emitError = (failure: Error): void => {
      if (!listeners.some((candidate) => candidate.event === 'error')) {
        throw failure;
      }
      emit('error', failure);
    };
    const closed = (): void => {
      if (state === 'closed') {
        return;
      }
      state = 'closed';
      mailbox = false;
      emit('close');
    };
    const client: ImapClient = {
      get mailbox() {
        return mailbox;
      },
      connect: async () => {
        steps.push('connect');
        if (connectFailure) {
          afterCurrentWork(closed);
          throw connectFailure;
        }
        state = 'open';
      },
      getMailboxLock: async (path) => {
        steps.push(`lock ${path}`);
        if (state === 'closed') {
          throw new Error(CONNECTION_NOT_AVAILABLE);
        }
        await server.selectionAnswered;
        if (server.lockFailure) {
          throw server.lockFailure;
        }
        lockedMailboxes.push(path);
        mailbox =
          server.uidValidity === undefined ? { exists: messages.length } : { uidValidity: server.uidValidity, exists: messages.length };
        return { release: () => steps.push(`release ${path}`) };
      },
      search: async (query) => {
        if (!mailbox) {
          return undefined;
        }
        searches.push(query);
        if (server.searchFailure) {
          throw server.searchFailure;
        }
        return 'uid' in query ? uidsInRange(messages, query.uid) : uidsReceivedSince(messages, query.since);
      },
      fetchOne: async (range) => {
        if (!mailbox) {
          return undefined;
        }
        await server.fetchAnswered;
        if (state === 'closed') {
          throw new Error(CONNECTION_NOT_AVAILABLE);
        }
        const message = messages.find((candidate) => String(candidate.uid) === range);
        if (message === undefined) {
          return false;
        }
        return message.source === undefined ? {} : { source: Buffer.from(message.source) };
      },
      logout: async () => {
        steps.push('logout');
        await server.logoutAnswered;
        closed();
        if (server.logoutFailure) {
          throw server.logoutFailure;
        }
      },
      on: (event, listener) => {
        listeners = [...listeners, { event, listener }];
        return client;
      },
    };
    created = [
      ...created,
      {
        options,
        isOpen: () => state === 'open',
        notifyArrival: (count) => {
          if (state === 'open' && mailbox) {
            mailbox = { ...mailbox, exists: count };
            emit('exists', { count });
          }
        },
        cut: (failure) => {
          if (state !== 'open') {
            return;
          }
          if (failure !== undefined) {
            emitError(failure);
          }
          closed();
        },
      },
    ];
    return client;
  };
  return {
    createClient,
    connections: () => created.map((connection) => connection.options),
    openConnections: () => created.filter((connection) => connection.isOpen()).map((connection) => connection.options),
    lockedMailboxes: () => lockedMailboxes,
    searches: () => searches,
    steps: () => steps,
    receive: (message) => {
      messages = [...messages, message];
      for (const connection of created) {
        connection.notifyArrival(messages.length);
      }
    },
    cutConnections: (failure) => {
      for (const connection of created) {
        connection.cut(failure);
      }
    },
    refuseConnections: (failure) => {
      connectFailure = failure;
    },
    acceptConnections: () => {
      connectFailure = undefined;
    },
  };
};
