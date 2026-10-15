import { MAILBOX_CREDENTIALS_MISSING, mailboxConnectedText } from '../../domain/presentation/mailbox.js';
import { isMailboxConfigured } from '../../domain/settings/mailboxConfigured.js';
import type { MailboxSettings } from '../../domain/settings/types.js';
import type { MailboxReader } from '../ports/mailboxReader.js';
import type { SettingsRepository } from '../ports/settingsRepository.js';
import { describeMailboxFailure } from './describeMailboxFailure.js';

export type MailboxForm = Partial<MailboxSettings>;

export interface MailboxTest {
  readonly ok: boolean;
  readonly detail: string;
}

export interface TestMailboxDependencies {
  readonly settings: SettingsRepository;
  readonly mailboxReader: MailboxReader;
}

const TEST_CONNECTION_TIMEOUT_MS = 15_000;

const accountToTest = (form: MailboxForm, saved: MailboxSettings): MailboxSettings => ({
  host: form.host || saved.host,
  port: Number(form.port || saved.port),
  user: form.user || saved.user,
  pass: form.pass || saved.pass,
  mailbox: form.mailbox || saved.mailbox,
});

export const testMailbox = async ({ settings, mailboxReader }: TestMailboxDependencies, form: MailboxForm): Promise<MailboxTest> => {
  const account = accountToTest(form, settings.load().imap);
  if (!isMailboxConfigured(account)) {
    return { ok: false, detail: MAILBOX_CREDENTIALS_MISSING };
  }
  try {
    const session = await mailboxReader.open(account, TEST_CONNECTION_TIMEOUT_MS);
    try {
      return { ok: true, detail: mailboxConnectedText(session.messageCount) };
    } finally {
      await session.close();
    }
  } catch (error) {
    return { ok: false, detail: describeMailboxFailure(error) };
  }
};
