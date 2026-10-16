import { readFileSync } from 'node:fs';
import type { EmailContent, EmailListing, EmailMessage } from '../application/ports/listingExtractor.js';
import { readAlertEmail } from '../application/sources/readAlertEmail.js';
import { extractVehicleInfo } from '../domain/parsing/vehicleInfo.js';
import { PARSE_EMAIL_USAGE_TEXT } from '../domain/presentation/commands.js';
import { publicationDateFromEmail } from '../domain/sites/emailKind.js';
import { yearOf } from '../domain/time/yearOf.js';
import { systemClock } from '../infrastructure/system/systemClock.js';
import { systemAlertEmailReading } from '../main.js';

const OFFLINE_OPTION = '--offline';

const EVERY_LINK = Number.POSITIVE_INFINITY;

const NO_LINK = 0;

const contentOf = (email: EmailMessage): EmailContent => ({
  messageId: email.messageId ?? '',
  from: email.from,
  subject: email.subject,
  html: email.html,
  text: email.text,
});

const shownListing = (email: EmailMessage, listing: EmailListing) => ({
  ...listing,
  publishedAt: publicationDateFromEmail(email.subject, email.date),
  sourceRef: email.messageId,
  description: undefined,
  vehicle: extractVehicleInfo(listing, { customBrands: [], currentYear: yearOf(systemClock.now()) }),
});

const file = process.argv[2];
if (!file) {
  console.error(PARSE_EMAIL_USAGE_TEXT);
  process.exit(1);
}
const reading = systemAlertEmailReading();
const email = await reading.extractor.readEmail(readFileSync(file));
const emailReading = await readAlertEmail(reading, contentOf(email), process.argv.includes(OFFLINE_OPTION) ? NO_LINK : EVERY_LINK);
console.log(
  JSON.stringify(
    {
      site: emailReading.site,
      pending: emailReading.pendingLinks.length,
      ignored: emailReading.ignoredLinks,
      listings: emailReading.listings.map((listing) => shownListing(email, listing)),
    },
    null,
    2,
  ),
);
