import { type FetchHttpSitesDependencies, type HttpSitesFetching, httpSitesFetching } from './application/sources/fetchHttpSites.js';
import { type MailboxPolling, mailboxPolling, type PollMailboxDependencies } from './application/sources/pollMailbox.js';
import type { SourceRunSummary } from './application/sources/sourceRunSummary.js';

const FIRST_RUN_DELAY_MS = 5_000;

const MINUTE_MS = 60_000;

const MIN_MAIL_MINUTES = 1;

const MIN_HTTP_MINUTES = 5;

export class Scheduler {
  private readonly mail: MailboxPolling;

  private readonly http: HttpSitesFetching;

  private timers: readonly NodeJS.Timeout[] = [];

  constructor(dependencies: PollMailboxDependencies & FetchHttpSitesDependencies) {
    this.mail = mailboxPolling(dependencies);
    this.http = httpSitesFetching(dependencies);
  }

  start(mailMinutes: number, httpMinutes: number): void {
    this.timers = [
      ...this.timers,
      setInterval(() => void this.runMail(), Math.max(MIN_MAIL_MINUTES, mailMinutes) * MINUTE_MS),
      setInterval(() => void this.runHttp(), Math.max(MIN_HTTP_MINUTES, httpMinutes) * MINUTE_MS),
    ];
    setTimeout(() => {
      void this.runMail();
      void this.runHttp();
    }, FIRST_RUN_DELAY_MS);
  }

  stop(): void {
    for (const timer of this.timers) {
      clearInterval(timer);
    }
    this.timers = [];
  }

  runMail(): Promise<SourceRunSummary> {
    return this.mail.poll();
  }

  rereadAll(): Promise<SourceRunSummary> {
    return this.mail.rereadAll();
  }

  runHttp(): Promise<readonly SourceRunSummary[]> {
    return this.http.fetchAll();
  }
}
