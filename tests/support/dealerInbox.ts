import type { ImapClient, ImapClientFactory } from '../../src/infrastructure/email/imap/imapClient.js';
import { type StoredImapMessage, simulatedImapClient } from './simulatedImapClient.js';

export interface AlertEmail {
  readonly uid: number;
  readonly from: string;
  readonly subject: string;
  readonly receivedAt: string;
  readonly messageId: string;
  readonly html: string;
}

export interface DealerInbox {
  readonly createClient: ImapClientFactory;
  readonly receive: (...messages: readonly StoredImapMessage[]) => void;
  readonly cutOffWhileReading: (uid: number) => void;
}

const DEALER_ADDRESS = 'concession.veille@example.com';

const BASE64_LINE = /.{1,76}/g;

const MAILBOX_UID_VALIDITY = 1n;

const GMAIL_CUT_OFF = 'Unexpected close';

const encodedWord = (text: string): string => `=?utf-8?B?${Buffer.from(text).toString('base64')}?=`;

const mimeSource = (email: AlertEmail): string =>
  [
    `From: ${email.from}`,
    `To: ${DEALER_ADDRESS}`,
    `Subject: ${encodedWord(email.subject)}`,
    `Date: ${new Date(email.receivedAt).toUTCString()}`,
    `Message-ID: ${email.messageId}`,
    'MIME-Version: 1.0',
    'Content-Type: text/html; charset="utf-8"',
    'Content-Transfer-Encoding: base64',
    '',
    ...(Buffer.from(email.html).toString('base64').match(BASE64_LINE) ?? []),
    '',
  ].join('\r\n');

export const alertEmail = (email: AlertEmail): StoredImapMessage => ({
  uid: email.uid,
  receivedAt: email.receivedAt,
  source: mimeSource(email),
});

export const dealerInbox = (): DealerInbox => {
  let messages: readonly StoredImapMessage[] = [];
  let cutOff: readonly string[] = [];
  const readOnce =
    (client: ImapClient): ImapClient['fetchOne'] =>
    (range, query, options) => {
      if (cutOff.includes(range)) {
        cutOff = cutOff.filter((uid) => uid !== range);
        return Promise.reject(new Error(GMAIL_CUT_OFF));
      }
      return client.fetchOne(range, query, options);
    };
  return {
    createClient: (options) => {
      const client = simulatedImapClient({ uidValidity: MAILBOX_UID_VALIDITY, messages }).createClient(options);
      return {
        get mailbox() {
          return client.mailbox;
        },
        connect: () => client.connect(),
        getMailboxLock: (path) => client.getMailboxLock(path),
        search: (query, searchOptions) => client.search(query, searchOptions),
        fetchOne: readOnce(client),
        logout: () => client.logout(),
        on: (event, listener) => client.on(event, listener),
      };
    },
    receive: (...received) => {
      messages = [...messages, ...received];
    },
    cutOffWhileReading: (uid) => {
      cutOff = [...cutOff, String(uid)];
    },
  };
};
