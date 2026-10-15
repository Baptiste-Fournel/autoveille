import type { MailboxPosition, MailboxStateRepository, ProcessedEmail } from '../../src/application/ports/mailboxStateRepository.js';
import type { TransactionParticipant } from './fakeTransaction.js';

export type FakeMailboxStateRepository = MailboxStateRepository & TransactionParticipant;

interface StoredPosition extends MailboxPosition {
  readonly mailbox: string;
}

interface State {
  readonly emails: readonly ProcessedEmail[];
  readonly positions: readonly StoredPosition[];
}

const START_OF_MAILBOX: MailboxPosition = { lastUid: 0, uidValidity: null };

const withResult = (recorded: ProcessedEmail, again: ProcessedEmail): ProcessedEmail => ({
  ...recorded,
  listingCount: again.listingCount,
  summary: again.summary,
  error: again.error,
  processedAt: again.processedAt,
});

const mostRecentlyProcessedFirst = (emails: readonly ProcessedEmail[]): readonly ProcessedEmail[] =>
  emails
    .map((email, recordedAt) => ({ email, recordedAt }))
    .sort((a, b) => b.email.processedAt.localeCompare(a.email.processedAt) || a.recordedAt - b.recordedAt)
    .map(({ email }) => email);

export const fakeMailboxStateRepository = (): FakeMailboxStateRepository => {
  let state: State = { emails: [], positions: [] };
  return {
    isProcessed: (messageId) => state.emails.some((email) => email.messageId === messageId),
    recordProcessed: (email) => {
      const known = state.emails.some((recorded) => recorded.messageId === email.messageId);
      state = {
        ...state,
        emails: known
          ? state.emails.map((recorded) => (recorded.messageId === email.messageId ? withResult(recorded, email) : recorded))
          : [...state.emails, email],
      };
    },
    recentlyProcessed: (limit) => mostRecentlyProcessedFirst(state.emails).slice(0, limit),
    position: (mailbox) => {
      const stored = state.positions.find((position) => position.mailbox === mailbox);
      return stored === undefined ? START_OF_MAILBOX : { lastUid: stored.lastUid, uidValidity: stored.uidValidity };
    },
    savePosition: (mailbox, position) => {
      const stored: StoredPosition = { mailbox, lastUid: position.lastUid, uidValidity: position.uidValidity };
      const known = state.positions.some((existing) => existing.mailbox === mailbox);
      state = {
        ...state,
        positions: known
          ? state.positions.map((existing) => (existing.mailbox === mailbox ? stored : existing))
          : [...state.positions, stored],
      };
    },
    forgetReadEmails: () => {
      state = { emails: [], positions: state.positions.map((position) => ({ ...position, lastUid: 0 })) };
    },
    snapshot: () => {
      const kept = state;
      return () => {
        state = kept;
      };
    },
  };
};
