import type { EmailListingSummary, EmailReadingSummary, ProcessedEmail } from '../../../application/ports/mailboxStateRepository.js';
import type { CheckNowSummary } from '../../../application/sources/checkNow.js';
import type { SourceRunSummary } from '../../../application/sources/sourceRunSummary.js';
import type { HttpSiteOverview, MailboxOverview, SiteOverview, SourcesOverview } from '../../../application/sources/sourcesOverview.js';
import type { HttpSiteTest } from '../../../application/sources/testHttpSite.js';
import { alertAdviceSentence, alertMismatchSentence } from '../../../domain/presentation/alerts.js';
import { SITE_ALERT_HELP } from '../../../domain/presentation/siteHelp.js';
import { targetedSearchLabel } from '../../../domain/presentation/targetedSearches.js';
import type { TargetedSearch } from '../../../domain/sites/alertSetup.js';
import type { RawListing } from '../../../domain/vehicle/types.js';
import type {
  CheckNowResponse,
  EmailListingDto,
  EmailReadingDto,
  HttpSiteStateDto,
  HttpSiteTestResponse,
  MailboxDto,
  ProcessedEmailDto,
  RereadResponse,
  SampleListingDto,
  SiteDto,
  SourceRunSummaryDto,
  SourcesResponse,
  TargetedSearchDto,
} from '../../../shared/api.js';
import { sourceRunDto } from './sourceRun.js';

const mailboxDto = (mailbox: MailboxOverview): MailboxDto => ({
  host: mailbox.host,
  port: mailbox.port,
  user: mailbox.user,
  hasPassword: mailbox.hasPassword,
  mailbox: mailbox.mailbox,
  configured: mailbox.configured,
  lastRun: mailbox.lastRun === null ? null : sourceRunDto(mailbox.lastRun),
});

const targetedSearchDto = (search: TargetedSearch): TargetedSearchDto =>
  search.kind === 'collection'
    ? { label: targetedSearchLabel(search), url: search.url, brands: [], maxYear: search.maxYear }
    : { label: targetedSearchLabel(search), url: search.url, brands: search.brands, minPrice: search.minPrice };

const adviceOf = (site: SiteOverview): string | null | undefined => {
  if (site.alert === null) {
    return null;
  }
  return site.advice === undefined ? undefined : alertAdviceSentence(site.advice);
};

const siteDto = (site: SiteOverview): SiteDto => ({
  key: site.key,
  label: site.label,
  searchUrl: site.searchUrl,
  prefilled: site.prefilled,
  help: SITE_ALERT_HELP[site.key],
  manageUrl: site.manageUrl,
  alertRadiusKm: site.alertRadiusKm,
  alertMaxKm: site.alertMaxKm,
  done: site.done,
  alert: site.alert,
  issues: site.issues.map(alertMismatchSentence),
  advice: adviceOf(site),
  digest: site.digest,
  targeted: site.targeted.map(targetedSearchDto),
});

const httpSiteStateDto = (site: HttpSiteOverview): HttpSiteStateDto => ({
  id: site.id,
  name: site.name,
  url: site.url,
  enabled: site.enabled,
  lastRun: site.lastRun === null ? null : sourceRunDto(site.lastRun),
});

const emailListingDto = (listing: EmailListingSummary): EmailListingDto => ({
  title: listing.title,
  price: listing.price,
  km: listing.km,
  year: listing.year,
  city: listing.city,
  postalCode: listing.postalCode,
  sellerType: listing.sellerType,
  url: listing.url,
});

const emailReadingDto = (summary: EmailReadingSummary): EmailReadingDto => ({
  listings: summary.listings.map(emailListingDto),
  pending: summary.pending,
  ignored: summary.ignored,
  announced: summary.announced,
  kind: summary.kind,
  moreUrl: summary.moreUrl,
  leftAside: summary.leftAside,
});

const processedEmailDto = (email: ProcessedEmail): ProcessedEmailDto => ({
  message_id: email.messageId,
  subject: email.subject,
  sender: email.sender,
  received_at: email.receivedAt,
  site: email.site,
  parsed_count: email.listingCount,
  error: email.error,
  processed_at: email.processedAt,
  parsed: email.summary === null ? null : emailReadingDto(email.summary),
});

export const sourcesDto = (overview: SourcesOverview): SourcesResponse => ({
  imap: mailboxDto(overview.imap),
  sites: overview.sites.map(siteDto),
  httpSites: overview.httpSites.map(httpSiteStateDto),
  emails: overview.emails.map(processedEmailDto),
});

const sampleListingDto = (listing: RawListing): SampleListingDto => ({
  title: listing.title,
  price: listing.price,
  km: listing.km,
  year: listing.year,
  city: listing.city,
  url: listing.url,
});

export const httpSiteTestDto = (test: HttpSiteTest): HttpSiteTestResponse =>
  test.sample === undefined
    ? { ok: test.ok, detail: test.detail }
    : { ok: test.ok, detail: test.detail, sample: test.sample.map(sampleListingDto) };

const sourceRunSummaryDto = (summary: SourceRunSummary): SourceRunSummaryDto => ({
  source: summary.source,
  ok: summary.ok,
  detail: summary.detail,
});

export const checkNowDto = (summary: CheckNowSummary): CheckNowResponse => ({
  mail: sourceRunSummaryDto(summary.mail),
  http: summary.http.map(sourceRunSummaryDto),
});

export const rereadDto = (mail: SourceRunSummary): RereadResponse => ({ mail: sourceRunSummaryDto(mail) });
