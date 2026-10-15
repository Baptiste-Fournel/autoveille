import type { MailboxSettings } from './types.js';

export const isMailboxConfigured = (mailbox: Pick<MailboxSettings, 'user' | 'pass'>): boolean => Boolean(mailbox.user && mailbox.pass);
