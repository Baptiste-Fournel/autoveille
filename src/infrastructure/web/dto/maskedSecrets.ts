import type { SubmittedSettings } from '../../../application/settings/submittedSettings.js';
import type { MailboxForm } from '../../../application/sources/testMailbox.js';
import type { Settings } from '../../../domain/settings/types.js';
import type { MailboxTestRequest, SettingsDto, SettingsRequest } from '../../../shared/api.js';

export const MASKED_SECRET = '••••••••';

const storedIfMasked = (sent: string, stored: string): string => (sent === MASKED_SECRET ? stored : sent);

export const withMaskedPassword = (settings: Settings): SettingsDto => ({
  ...settings,
  imap: { ...settings.imap, pass: settings.imap.pass ? MASKED_SECRET : '' },
});

export const withStoredSecrets = (submitted: SettingsRequest, stored: Settings): SubmittedSettings => ({
  ...submitted,
  ...(submitted.imap === undefined ? {} : { imap: { ...submitted.imap, pass: storedIfMasked(submitted.imap.pass, stored.imap.pass) } }),
  ...(submitted.notifications === undefined
    ? {}
    : {
        notifications: {
          ...submitted.notifications,
          telegramToken: storedIfMasked(submitted.notifications.telegramToken, stored.notifications.telegramToken),
        },
      }),
});

export const mailboxFormOf = (request: MailboxTestRequest, stored: Settings): MailboxForm => ({
  host: request.host,
  port: request.port,
  user: request.user,
  pass: request.pass === undefined ? undefined : storedIfMasked(request.pass, stored.imap.pass),
  mailbox: request.mailbox,
});
