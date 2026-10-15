import { type ParsedMail, simpleParser } from 'mailparser';
import type { EmailMessage, EmailReading, ListingExtractor } from './application/ports/listingExtractor.js';
import { visibleText } from './sources/email/confirmations.js';
import { type ParsedEmail, parseAlertEmail } from './sources/email/parse.js';
import { listingsFromPage } from './sources/http.js';

const instantOf = (date: Date | undefined): string | undefined =>
  date === undefined || Number.isNaN(date.getTime()) ? undefined : date.toISOString();

const emailMessageOf = (parsed: ParsedMail): EmailMessage => ({
  messageId: parsed.messageId,
  from: parsed.from?.value?.[0]?.address ?? '',
  subject: parsed.subject ?? '',
  date: instantOf(parsed.date),
  html: typeof parsed.html === 'string' ? parsed.html : undefined,
  text: parsed.text,
});

const emailReadingOf = (parsed: ParsedEmail): EmailReading => ({
  site: parsed.site,
  listings: parsed.listings,
  pendingLinks: parsed.pending,
  ignoredLinks: parsed.ignored,
  moreUrl: parsed.moreUrl,
});

export const legacyListingExtractor: ListingExtractor = {
  readEmail: async (source) => emailMessageOf(await simpleParser(Buffer.from(source))),
  listingsFromEmail: (email, resolvedLinks) =>
    emailReadingOf(
      parseAlertEmail(
        { html: email.html, text: email.text, subject: email.subject, from: email.from, messageId: email.messageId },
        new Map(resolvedLinks),
      ),
    ),
  visibleContent: (email) => visibleText(email),
  listingsFromPage,
};
