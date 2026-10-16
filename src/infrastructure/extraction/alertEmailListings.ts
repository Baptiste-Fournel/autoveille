import type { EmailContent, EmailReading } from '../../application/ports/listingExtractor.js';
import { siteForSender } from '../../domain/sites/catalog.js';
import { htmlAlertListings } from './htmlAlertListings.js';
import { textAlertListings } from './textAlertListings.js';

export const alertEmailListings = (email: EmailContent, resolvedLinks: ReadonlyMap<string, string>, maxYear: number): EmailReading => {
  const emailSite = email.from ? siteForSender(email.from) : undefined;
  const context = { emailSite, resolvedLinks, sourceRef: email.messageId, maxYear };
  if (email.html?.trim()) {
    return htmlAlertListings(email.html, context);
  }
  if (email.text?.trim()) {
    return textAlertListings(email.text, context);
  }
  return { site: emailSite?.key, listings: [], pendingLinks: [], ignoredLinks: 0 };
};
