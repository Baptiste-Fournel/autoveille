import type { MailboxReader, MailboxSession } from '../../../application/ports/mailboxReader.js';
import { friendlyError } from './friendlyError.js';
import { connectionOptions, type ImapClient, type ImapClientFactory, type ImapSearch, loggedOut } from './imapClient.js';

const failureReportedByPendingCommand = (): void => undefined;

const ascending = (uids: number[] | false | undefined): readonly number[] => (uids ? [...uids].sort((a, b) => a - b) : []);

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
    client.on('error', failureReportedByPendingCommand);
    await client.connect().catch((error: unknown) => {
      throw friendlyError(error);
    });
    return sessionOn(client, account.mailbox);
  },
});
