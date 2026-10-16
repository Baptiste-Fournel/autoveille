import type { EmailReadingSummary, MailboxPosition, ProcessedEmail } from '../../../application/ports/mailboxStateRepository.js';

export interface ProcessedEmailRow {
  readonly message_id: string;
  readonly uid: number | null;
  readonly subject: string;
  readonly sender: string;
  readonly received_at: string | null;
  readonly site: string | null;
  readonly parsed_count: number;
  readonly parsed_json: string | null;
  readonly error: string | null;
  readonly processed_at: string;
}

export interface MailboxPositionRow {
  readonly mailbox: string;
  readonly last_uid: number;
  readonly uid_validity: number | null;
}

const START_OF_MAILBOX: MailboxPosition = { lastUid: 0, uidValidity: null };

const summaryOf = (json: string | null): EmailReadingSummary | null => {
  if (json === null) {
    return null;
  }
  const summary: EmailReadingSummary = JSON.parse(json);
  return summary;
};

export const processedEmailOf = (row: ProcessedEmailRow): ProcessedEmail => ({
  messageId: row.message_id,
  uid: row.uid,
  subject: row.subject,
  sender: row.sender,
  receivedAt: row.received_at,
  site: row.site,
  listingCount: row.parsed_count,
  summary: summaryOf(row.parsed_json),
  error: row.error,
  processedAt: row.processed_at,
});

export const processedEmailRowOf = (email: ProcessedEmail): ProcessedEmailRow => ({
  message_id: email.messageId,
  uid: email.uid,
  subject: email.subject,
  sender: email.sender,
  received_at: email.receivedAt,
  site: email.site,
  parsed_count: email.listingCount,
  parsed_json: email.summary === null ? null : JSON.stringify(email.summary),
  error: email.error,
  processed_at: email.processedAt,
});

export const mailboxPositionOf = (row: MailboxPositionRow | undefined): MailboxPosition =>
  row === undefined ? START_OF_MAILBOX : { lastUid: row.last_uid, uidValidity: row.uid_validity };

export const mailboxPositionRowOf = (mailbox: string, position: MailboxPosition): MailboxPositionRow => ({
  mailbox,
  last_uid: position.lastUid,
  uid_validity: position.uidValidity,
});
