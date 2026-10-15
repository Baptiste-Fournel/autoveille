import { defaultSettings } from '../../src/domain/settings/defaults.js';
import type { MailboxSettings, Settings } from '../../src/domain/settings/types.js';

export const DEALER_MAILBOX: MailboxSettings = {
  host: 'imap.gmail.com',
  port: 993,
  user: 'concession.veille@example.com',
  pass: 'abcd efgh ijkl mnop',
  mailbox: 'INBOX',
};

export const settingsWithDealerMailbox = (fields: Partial<Settings> = {}): Settings => ({
  ...defaultSettings(),
  imap: DEALER_MAILBOX,
  ...fields,
});
