import type { EmailLink } from '../../domain/sites/confirmations.js';
import type { RawListing } from '../../domain/vehicle/types.js';

export interface EmailMessage {
  readonly messageId?: string;
  readonly from: string;
  readonly subject: string;
  readonly date?: string;
  readonly html?: string;
  readonly text?: string;
}

export interface EmailContent {
  readonly messageId: string;
  readonly from: string;
  readonly subject: string;
  readonly html?: string;
  readonly text?: string;
}

export interface PendingLink {
  readonly href: string;
  readonly text: string;
}

export type EmailListing = Omit<RawListing, 'publishedAt'>;

export interface EmailReading {
  readonly site?: string;
  readonly listings: readonly EmailListing[];
  readonly pendingLinks: readonly PendingLink[];
  readonly ignoredLinks: number;
  readonly moreUrl?: string;
}

export interface VisibleContent {
  readonly text: string;
  readonly links: readonly EmailLink[];
}

export interface FetchedPage {
  readonly url: string;
  readonly html: string;
}

export type PageReadingMethod = 'structuredData' | 'links';

export interface PageReading {
  readonly listings: readonly RawListing[];
  readonly method: PageReadingMethod;
}

export interface ListingExtractor {
  readEmail(source: Uint8Array): Promise<EmailMessage>;
  listingsFromEmail(email: EmailContent, resolvedLinks: ReadonlyMap<string, string>): EmailReading;
  visibleContent(email: Pick<EmailMessage, 'html' | 'text'>): VisibleContent;
  listingsFromPage(page: FetchedPage): PageReading;
}
