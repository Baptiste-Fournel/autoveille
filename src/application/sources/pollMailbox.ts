import {
  alertConfirmedLog,
  emailErrorText,
  emailsToProcessLog,
  MAILBOX_NOT_CONFIGURED,
  type MailboxPassCounts,
  mailboxPassDetail,
  mailboxPassLog,
  truncatedDigestNotificationFailedLog,
  truncatedEmailLog,
} from '../../domain/presentation/mailbox.js';
import { recordAlertConfirmation } from '../../domain/settings/alerts.js';
import type { MailboxSettings } from '../../domain/settings/types.js';
import { siteForSender, siteLabel } from '../../domain/sites/catalog.js';
import { detectAlertConfirmation } from '../../domain/sites/confirmations.js';
import { announcedCount, classifyEmail, type EmailKind, publicationDateFromEmail } from '../../domain/sites/emailKind.js';
import { notifiesTruncatedDigest, type TruncatedNewAdsDigest, truncatedNewAdsDigest } from '../../domain/sites/truncatedDigest.js';
import { daysBefore } from '../../domain/time/daysBefore.js';
import type { IngestDependencies } from '../ingest/ingestListing.js';
import { notifyTruncatedDigest } from '../notifications/notifyTruncatedDigest.js';
import type { EmailMessage, EmailReading } from '../ports/listingExtractor.js';
import type { Logger } from '../ports/logger.js';
import type { MailboxReader, MailboxSession } from '../ports/mailboxReader.js';
import type { EmailReadingSummary, MailboxStateRepository } from '../ports/mailboxStateRepository.js';
import type { SourceRunRepository } from '../ports/sourceRunRepository.js';
import { describeMailboxFailure } from './describeMailboxFailure.js';
import { errorMessage } from './errorMessage.js';
import { ingestInTurn } from './ingestInTurn.js';
import { type AlertEmailReadingDependencies, readAlertEmail } from './readAlertEmail.js';
import type { SourceRunSummary } from './sourceRunSummary.js';

export interface PollMailboxDependencies extends IngestDependencies, AlertEmailReadingDependencies {
  readonly mailboxReader: MailboxReader;
  readonly mailboxState: MailboxStateRepository;
  readonly sourceRuns: SourceRunRepository;
  readonly logger: Logger;
}

export interface MailboxPolling {
  readonly poll: () => Promise<SourceRunSummary>;
  readonly rereadAll: () => Promise<SourceRunSummary>;
}

const FIRST_READING_DAYS = 3;
const MAX_EMAILS_PER_PASS = 60;
const MAX_LINKS_RESOLVED_PER_EMAIL = 40;
const MAIL_SOURCE = 'email';

interface SubjectReading {
  readonly kind: EmailKind;
  readonly announced: number | undefined;
}

type EmailOutcome =
  | { readonly kind: 'vanished' }
  | { readonly kind: 'alreadyProcessed' }
  | { readonly kind: 'read'; readonly listings: number; readonly matched: number }
  | { readonly kind: 'failed'; readonly error: string };

const NO_EMAIL_READ: MailboxPassCounts = { processed: 0, listings: 0, matched: 0, errors: [] };

const counted = (counts: MailboxPassCounts, outcome: EmailOutcome): MailboxPassCounts => {
  switch (outcome.kind) {
    case 'read':
      return {
        ...counts,
        processed: counts.processed + 1,
        listings: counts.listings + outcome.listings,
        matched: counts.matched + outcome.matched,
      };
    case 'failed':
      return { ...counts, errors: [...counts.errors, outcome.error] };
    default:
      return counts;
  }
};

const fallbackMessageId = (uidValidity: number | null, uid: number): string => `uid-${uidValidity ?? 0}-${uid}`;

const recordConfirmation = (dependencies: PollMailboxDependencies, email: EmailMessage): void => {
  if (!siteForSender(email.from)) {
    return;
  }
  const { text, links } = dependencies.extractor.visibleContent(email);
  const date = new Date(email.date ?? dependencies.clock.now());
  const confirmation = detectAlertConfirmation({ from: email.from, subject: email.subject, text, links, date });
  if (confirmation === undefined) {
    return;
  }
  const current = dependencies.settings.load();
  const next = recordAlertConfirmation(current, confirmation);
  if (next !== current) {
    dependencies.settings.save(next);
  }
  dependencies.logger.info(alertConfirmedLog(confirmation.site, confirmation.criteria));
};

const announceTruncatedDigest = async (
  dependencies: PollMailboxDependencies,
  digest: TruncatedNewAdsDigest | undefined,
  moreUrl: string | undefined,
): Promise<void> => {
  if (digest === undefined) {
    return;
  }
  const name = siteLabel(digest.site);
  dependencies.logger.info(truncatedEmailLog(name, digest.announced, digest.received));
  if (!notifiesTruncatedDigest(digest)) {
    return;
  }
  try {
    await notifyTruncatedDigest(dependencies, { siteLabel: name, announced: digest.announced, received: digest.received, moreUrl });
  } catch (error) {
    dependencies.logger.info(truncatedDigestNotificationFailedLog(String(error)));
  }
};

const summaryOf = (reading: EmailReading, subjectReading: SubjectReading): EmailReadingSummary => ({
  listings: reading.listings.map(({ title, price, km, year, city, postalCode, sellerType, url }) => ({
    title,
    price,
    km,
    year,
    city,
    postalCode,
    sellerType,
    url,
  })),
  pending: reading.pendingLinks.length,
  ignored: reading.ignoredLinks,
  announced: subjectReading.announced,
  kind: subjectReading.kind,
  moreUrl: reading.moreUrl,
});

const readEmail = async (
  dependencies: PollMailboxDependencies,
  source: Uint8Array,
  uid: number,
  uidValidity: number | null,
): Promise<EmailOutcome> => {
  const email = await dependencies.extractor.readEmail(source);
  const messageId = email.messageId ?? fallbackMessageId(uidValidity, uid);
  if (dependencies.mailboxState.isProcessed(messageId)) {
    return { kind: 'alreadyProcessed' };
  }
  recordConfirmation(dependencies, email);
  const reading = await readAlertEmail(
    dependencies,
    { messageId, from: email.from, subject: email.subject, html: email.html, text: email.text },
    MAX_LINKS_RESOLVED_PER_EMAIL,
  );
  const subjectReading: SubjectReading = { kind: classifyEmail(email.subject), announced: announcedCount(email.subject) };
  const digest = truncatedNewAdsDigest({ site: reading.site, ...subjectReading, received: reading.listings.length });
  await announceTruncatedDigest(dependencies, digest, reading.moreUrl);
  const publishedAt = publicationDateFromEmail(email.subject, email.date);
  const matched = await ingestInTurn(
    dependencies,
    reading.listings.map((listing) => ({ ...listing, publishedAt })),
  );
  dependencies.mailboxState.recordProcessed({
    messageId,
    uid,
    subject: email.subject,
    sender: email.from,
    receivedAt: email.date ?? null,
    site: reading.site ?? null,
    listingCount: reading.listings.length,
    summary: summaryOf(reading, subjectReading),
    error: null,
    processedAt: dependencies.clock.now(),
  });
  return { kind: 'read', listings: reading.listings.length, matched };
};

const processEmail = async (dependencies: PollMailboxDependencies, session: MailboxSession, uid: number): Promise<EmailOutcome> => {
  try {
    const source = await session.read(uid);
    return source === undefined ? { kind: 'vanished' } : await readEmail(dependencies, source, uid, session.uidValidity);
  } catch (error) {
    const message = errorMessage(error);
    dependencies.mailboxState.recordProcessed({
      messageId: fallbackMessageId(session.uidValidity, uid),
      uid,
      subject: '',
      sender: '',
      receivedAt: null,
      site: null,
      listingCount: 0,
      summary: null,
      error: message,
      processedAt: dependencies.clock.now(),
    });
    return { kind: 'failed', error: emailErrorText(uid, message) };
  }
};

const uidsToRead = async (dependencies: PollMailboxDependencies, session: MailboxSession, lastUid: number): Promise<readonly number[]> => {
  const found =
    lastUid === 0 ? await session.uidsSince(daysBefore(dependencies.clock.now(), FIRST_READING_DAYS)) : await session.uidsAfter(lastUid);
  return found.slice(0, MAX_EMAILS_PER_PASS);
};

const readMailbox = async (dependencies: PollMailboxDependencies, account: MailboxSettings): Promise<MailboxPassCounts> => {
  const session = await dependencies.mailboxReader.open(account);
  try {
    const { uidValidity } = session;
    const position = dependencies.mailboxState.position(account.mailbox);
    const mailboxRenumbered = position.uidValidity !== null && uidValidity !== null && position.uidValidity !== uidValidity;
    const startUid = mailboxRenumbered ? 0 : position.lastUid;
    const uids = await uidsToRead(dependencies, session, startUid);
    dependencies.logger.info(emailsToProcessLog(uids.length));
    let counts = NO_EMAIL_READ;
    let lastUid = startUid;
    for (const uid of uids) {
      const outcome = await processEmail(dependencies, session, uid);
      counts = counted(counts, outcome);
      lastUid = outcome.kind === 'vanished' ? lastUid : Math.max(lastUid, uid);
    }
    dependencies.mailboxState.savePosition(account.mailbox, { lastUid, uidValidity });
    return counts;
  } finally {
    await session.close();
  }
};

const recordPass = (dependencies: PollMailboxDependencies, ok: boolean, detail: string): void => {
  dependencies.sourceRuns.record({ source: MAIL_SOURCE, lastRunAt: dependencies.clock.now(), ok, detail });
  dependencies.logger.info(mailboxPassLog(detail));
};

export const pollMailbox = async (dependencies: PollMailboxDependencies): Promise<SourceRunSummary> => {
  const { imap } = dependencies.settings.load();
  if (!imap.user || !imap.pass || !imap.host) {
    return { source: MAIL_SOURCE, ok: false, detail: MAILBOX_NOT_CONFIGURED };
  }
  try {
    const counts = await readMailbox(dependencies, imap);
    const detail = mailboxPassDetail(counts);
    recordPass(dependencies, counts.errors.length === 0, detail);
    return { source: MAIL_SOURCE, ok: true, detail };
  } catch (error) {
    const detail = describeMailboxFailure(error);
    recordPass(dependencies, false, detail);
    return { source: MAIL_SOURCE, ok: false, detail };
  }
};

export const mailboxPolling = (dependencies: PollMailboxDependencies): MailboxPolling => {
  let inProgress: Promise<SourceRunSummary> | undefined;
  const poll = (): Promise<SourceRunSummary> => {
    if (inProgress === undefined) {
      inProgress = pollMailbox(dependencies).finally(() => {
        inProgress = undefined;
      });
    }
    return inProgress;
  };
  const rereadAll = async (): Promise<SourceRunSummary> => {
    await inProgress;
    dependencies.mailboxState.forgetReadEmails();
    return poll();
  };
  return { poll, rereadAll };
};
