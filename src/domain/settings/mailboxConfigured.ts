import type { MailboxSettings } from './types.js';

export const isMailboxConfigured = (mailbox: Pick<MailboxSettings, 'user' | 'pass'>): boolean => Boolean(mailbox.user && mailbox.pass);

export const isMailboxReadable = (mailbox: MailboxSettings): boolean => isMailboxConfigured(mailbox) && Boolean(mailbox.host);
