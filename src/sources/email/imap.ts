import { ImapFlow } from 'imapflow';
import type { MailboxReader, MailboxSession } from '../../application/ports/mailboxReader.js';
import { type MailboxProblem, MailboxUnavailable } from '../../application/ports/mailboxUnavailable.js';
import type { MailboxSettings } from '../../domain/settings/types.js';

const AUTHENTICATION_REFUSED = /auth|credentials|invalid|login|password/i;

const SERVER_UNREACHABLE = /ENOTFOUND|EAI_AGAIN|ECONN|timeout/i;

const SECURE_IMAP_PORT = 993;

const problemOf = (message: string): MailboxProblem => {
  if (AUTHENTICATION_REFUSED.test(message)) {
    return 'authenticationRefused';
  }
  return SERVER_UNREACHABLE.test(message) ? 'serverUnreachable' : 'readFailed';
};

const mailboxUnavailable = (error: unknown): MailboxUnavailable => {
  const message = error instanceof Error ? error.message : String(error);
  return new MailboxUnavailable(problemOf(message), message);
};

const ascending = (uids: number[] | false | undefined): readonly number[] => (Array.isArray(uids) ? [...uids] : []).sort((a, b) => a - b);

const clientFor = (account: MailboxSettings, connectionTimeoutMs: number | undefined): ImapFlow =>
  new ImapFlow({
    host: account.host,
    port: account.port,
    secure: account.port === SECURE_IMAP_PORT,
    auth: { user: account.user, pass: account.pass },
    logger: false,
    ...(connectionTimeoutMs === undefined ? {} : { connectionTimeout: connectionTimeoutMs }),
  });

const loggedOut = (client: ImapFlow): Promise<void> => client.logout().catch(() => undefined);

const openSession = async (client: ImapFlow, mailboxName: string): Promise<MailboxSession> => {
  const lock = await client.getMailboxLock(mailboxName).catch(async (error: unknown) => {
    await loggedOut(client);
    throw mailboxUnavailable(error);
  });
  const { mailbox } = client;
  return {
    uidValidity: mailbox && typeof mailbox === 'object' && 'uidValidity' in mailbox ? Number(mailbox.uidValidity) : null,
    messageCount: mailbox && typeof mailbox === 'object' && 'exists' in mailbox ? Number(mailbox.exists) : 0,
    uidsAfter: async (uid) => {
      const found = await client.search({ uid: `${uid + 1}:*` }, { uid: true }).catch((error: unknown) => {
        throw mailboxUnavailable(error);
      });
      return ascending(found).filter((candidate) => candidate > uid);
    },
    uidsSince: async (instant) => {
      const found = await client.search({ since: new Date(instant) }, { uid: true }).catch((error: unknown) => {
        throw mailboxUnavailable(error);
      });
      return ascending(found);
    },
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

export const imapMailboxReader: MailboxReader = {
  open: async (account, connectionTimeoutMs) => {
    const client = clientFor(account, connectionTimeoutMs);
    await client.connect().catch((error: unknown) => {
      throw mailboxUnavailable(error);
    });
    return openSession(client, account.mailbox);
  },
};
