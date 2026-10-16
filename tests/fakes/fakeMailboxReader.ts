import type { MailboxReader, MailboxSession } from '../../src/application/ports/mailboxReader.js';
import { MailboxUnavailable } from '../../src/application/ports/mailboxUnavailable.js';
import type { MailboxSettings } from '../../src/domain/settings/types.js';

export interface StoredEmail {
  readonly uid: number;
  readonly receivedAt: string;
  readonly source: string;
}

export interface FakeMailboxOptions {
  readonly uidValidity?: number | null;
  readonly emails?: readonly StoredEmail[];
  readonly refusal?: MailboxUnavailable;
  readonly unreadableUids?: readonly number[];
}

export interface MailboxOpening {
  readonly account: MailboxSettings;
  readonly connectionTimeoutMs: number | undefined;
}

export interface FakeMailboxReader extends MailboxReader {
  readonly openings: () => readonly MailboxOpening[];
  readonly openSessions: () => number;
}

const DAY_LENGTH = 'YYYY-MM-DD'.length;

const dayOf = (instant: string): string => instant.slice(0, DAY_LENGTH);

const ascending = (uids: readonly number[]): readonly number[] => [...uids].sort((a, b) => a - b);

export const fakeMailboxReader = (options: FakeMailboxOptions = {}): FakeMailboxReader => {
  const emails = options.emails ?? [];
  const uidValidity = options.uidValidity === undefined ? 1 : options.uidValidity;
  let openings: readonly MailboxOpening[] = [];
  let openSessions = 0;
  const unreadable = options.unreadableUids ?? [];
  return {
    open: async (account, connectionTimeoutMs) => {
      openings = [...openings, { account, connectionTimeoutMs }];
      if (options.refusal !== undefined) {
        throw options.refusal;
      }
      openSessions += 1;
      const session: MailboxSession = {
        uidValidity,
        messageCount: emails.length,
        uidsAfter: async (uid) => ascending(emails.filter((email) => email.uid > uid).map((email) => email.uid)),
        uidsSince: async (instant) =>
          ascending(emails.filter((email) => dayOf(email.receivedAt) >= dayOf(instant)).map((email) => email.uid)),
        read: async (uid) => {
          if (unreadable.includes(uid)) {
            throw new MailboxUnavailable('readFailed', 'Unexpected close');
          }
          const email = emails.find((candidate) => candidate.uid === uid);
          return email === undefined ? undefined : new TextEncoder().encode(email.source);
        },
        close: async () => {
          openSessions -= 1;
        },
      };
      return session;
    },
    openings: () => openings,
    openSessions: () => openSessions,
  };
};
