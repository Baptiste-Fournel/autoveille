import type { HttpSitesFetching } from './fetchHttpSites.js';
import type { MailboxPolling } from './pollMailbox.js';
import type { SourceRunSummary } from './sourceRunSummary.js';

export interface CheckedSources {
  readonly mailbox: Pick<MailboxPolling, 'poll'>;
  readonly httpSites: Pick<HttpSitesFetching, 'fetchAll'>;
}

export interface CheckNowSummary {
  readonly mail: SourceRunSummary;
  readonly http: readonly SourceRunSummary[];
}

export const checkNow = async (sources: CheckedSources): Promise<CheckNowSummary> => {
  const mail = await sources.mailbox.poll();
  const http = await sources.httpSites.fetchAll();
  return { mail, http };
};
