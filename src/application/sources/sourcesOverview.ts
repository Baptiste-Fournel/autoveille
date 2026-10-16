import { isMailboxConfigured } from '../../domain/settings/mailboxConfigured.js';
import type { AlertInfo, HttpSite, Settings } from '../../domain/settings/types.js';
import { type SiteSetup, siteSetups, type TargetedSearch, targetedSearches } from '../../domain/sites/alertSetup.js';
import { type AlertMismatch, type AlertWidening, alertAdvice, alertMismatch } from '../../domain/sites/confirmations.js';
import { truncatedNewAdsDigest } from '../../domain/sites/truncatedDigest.js';
import type { MailboxStateRepository, ProcessedEmail } from '../ports/mailboxStateRepository.js';
import type { SettingsRepository } from '../ports/settingsRepository.js';
import type { SourceRun, SourceRunRepository } from '../ports/sourceRunRepository.js';

export interface MailboxOverview {
  readonly host: string;
  readonly port: number;
  readonly user: string;
  readonly hasPassword: boolean;
  readonly mailbox: string;
  readonly configured: boolean;
  readonly lastRun: SourceRun | null;
}

export interface TruncatedDigest {
  readonly at: string | null;
  readonly announced: number;
  readonly received: number;
  readonly url: string | null;
  readonly subject: string;
}

export interface SiteOverview extends SiteSetup {
  readonly done: boolean;
  readonly alert: AlertInfo | null;
  readonly issues: readonly AlertMismatch[];
  readonly advice?: AlertWidening;
  readonly digest: TruncatedDigest | null;
  readonly targeted: readonly TargetedSearch[];
}

export interface HttpSiteOverview extends HttpSite {
  readonly lastRun: SourceRun | null;
}

export interface SourcesOverview {
  readonly imap: MailboxOverview;
  readonly sites: readonly SiteOverview[];
  readonly httpSites: readonly HttpSiteOverview[];
  readonly emails: readonly ProcessedEmail[];
}

export interface SourcesOverviewDependencies {
  readonly settings: SettingsRepository;
  readonly sourceRuns: SourceRunRepository;
  readonly mailboxState: MailboxStateRepository;
}

const EMAILS_SEARCHED_FOR_DIGESTS = 60;
const EMAILS_SHOWN = 25;

const truncatedDigestOf = (email: ProcessedEmail): readonly (readonly [string, TruncatedDigest])[] => {
  const { summary } = email;
  if (summary === null) {
    return [];
  }
  const digest = truncatedNewAdsDigest({
    site: email.site,
    kind: summary.kind,
    announced: summary.announced,
    received: email.listingCount,
  });
  if (digest === undefined) {
    return [];
  }
  return [
    [
      digest.site,
      {
        at: email.receivedAt ?? email.processedAt,
        announced: digest.announced,
        received: digest.received,
        url: summary.moreUrl ?? null,
        subject: email.subject,
      },
    ],
  ];
};

const latestTruncatedDigestBySite = (mostRecentFirst: readonly ProcessedEmail[]): ReadonlyMap<string, TruncatedDigest> =>
  new Map([...mostRecentFirst].reverse().flatMap(truncatedDigestOf));

const lastRunOf = (runs: readonly SourceRun[], source: SourceRun['source']): SourceRun | null =>
  runs.find((run) => run.source === source) ?? null;

const siteOverview = (setup: SiteSetup, settings: Settings, digests: ReadonlyMap<string, TruncatedDigest>): SiteOverview => {
  const alert = settings.alerts[setup.key];
  return {
    ...setup,
    done: Boolean(settings.alertsDone[setup.key]),
    alert: alert ?? null,
    issues: alert ? alertMismatch(alert, settings) : [],
    advice: alert ? alertAdvice(alert, settings) : undefined,
    digest: digests.get(setup.key) ?? null,
    targeted: targetedSearches(settings, setup.key),
  };
};

export const sourcesOverview = ({ settings, sourceRuns, mailboxState }: SourcesOverviewDependencies): SourcesOverview => {
  const current = settings.load();
  const runs = sourceRuns.all();
  const emails = mailboxState.recentlyProcessed(EMAILS_SEARCHED_FOR_DIGESTS);
  const digests = latestTruncatedDigestBySite(emails);
  const { imap } = current;
  return {
    imap: {
      host: imap.host,
      port: imap.port,
      user: imap.user,
      hasPassword: Boolean(imap.pass),
      mailbox: imap.mailbox,
      configured: isMailboxConfigured(imap),
      lastRun: lastRunOf(runs, 'email'),
    },
    sites: siteSetups(current).map((setup) => siteOverview(setup, current, digests)),
    httpSites: current.httpSites.map((site) => ({ ...site, lastRun: lastRunOf(runs, `http:${site.id}`) })),
    emails: emails.slice(0, EMAILS_SHOWN),
  };
};
