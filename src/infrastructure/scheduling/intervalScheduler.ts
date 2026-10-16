import type { HttpSitesFetching } from '../../application/sources/fetchHttpSites.js';
import type { MailboxPolling } from '../../application/sources/pollMailbox.js';
import type { Timers } from './timers.js';

const FIRST_RUN_DELAY_MS = 5_000;

const MINUTE_MS = 60_000;

const MIN_MAILBOX_MINUTES = 1;

const MIN_HTTP_SITES_MINUTES = 5;

export interface ScheduledSources {
  readonly mailbox: Pick<MailboxPolling, 'poll'>;
  readonly httpSites: Pick<HttpSitesFetching, 'fetchAll'>;
}

export type FailureReport = (error: unknown) => void;

export interface PollingCadence {
  readonly mailboxMinutes: number;
  readonly httpSitesMinutes: number;
}

export class IntervalScheduler<Handle> {
  private readonly sources: ScheduledSources;

  private readonly timers: Timers<Handle>;

  private readonly reportFailure: FailureReport;

  private intervals: readonly Handle[] = [];

  private firstRuns: readonly Handle[] = [];

  constructor(sources: ScheduledSources, timers: Timers<Handle>, reportFailure: FailureReport) {
    this.sources = sources;
    this.timers = timers;
    this.reportFailure = reportFailure;
  }

  start(cadence: PollingCadence): void {
    const pollMailbox = (): void => void this.sources.mailbox.poll().catch(this.reportFailure);
    const fetchHttpSites = (): void => void this.sources.httpSites.fetchAll().catch(this.reportFailure);
    this.intervals = [
      ...this.intervals,
      this.timers.setInterval(pollMailbox, Math.max(MIN_MAILBOX_MINUTES, cadence.mailboxMinutes) * MINUTE_MS),
      this.timers.setInterval(fetchHttpSites, Math.max(MIN_HTTP_SITES_MINUTES, cadence.httpSitesMinutes) * MINUTE_MS),
    ];
    this.firstRuns = [
      ...this.firstRuns,
      this.timers.setTimeout(() => {
        pollMailbox();
        fetchHttpSites();
      }, FIRST_RUN_DELAY_MS),
    ];
  }

  stop(): void {
    for (const interval of this.intervals) {
      this.timers.clearInterval(interval);
    }
    for (const firstRun of this.firstRuns) {
      this.timers.clearTimeout(firstRun);
    }
    this.intervals = [];
    this.firstRuns = [];
  }
}
