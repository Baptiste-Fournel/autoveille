import type { EmailKind } from '../../domain/sites/emailKind.js';
import type { SellerType } from '../../domain/vehicle/types.js';

export interface EmailListingSummary {
  readonly title: string;
  readonly price?: number;
  readonly km?: number;
  readonly year?: number;
  readonly city?: string;
  readonly postalCode?: string;
  readonly sellerType?: SellerType;
  readonly url: string;
}

export interface EmailReadingSummary {
  readonly listings: readonly EmailListingSummary[];
  readonly pending: number;
  readonly ignored: number;
  readonly announced?: number;
  readonly kind?: EmailKind;
  readonly moreUrl?: string;
  readonly leftAside?: number;
}

export interface ProcessedEmail {
  readonly messageId: string;
  readonly uid: number | null;
  readonly subject: string;
  readonly sender: string;
  readonly receivedAt: string | null;
  readonly site: string | null;
  readonly listingCount: number;
  readonly summary: EmailReadingSummary | null;
  readonly error: string | null;
  readonly processedAt: string;
}

export interface MailboxPosition {
  readonly lastUid: number;
  readonly uidValidity: number | null;
}

export interface MailboxStateRepository {
  isProcessed(messageId: string): boolean;
  recordProcessed(email: ProcessedEmail): void;
  recentlyProcessed(limit: number): readonly ProcessedEmail[];
  position(mailbox: string): MailboxPosition;
  savePosition(mailbox: string, position: MailboxPosition): void;
  forgetReadEmails(): void;
}
