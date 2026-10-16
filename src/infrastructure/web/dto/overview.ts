import type { AlertIssue, Overview } from '../../../application/overview/overview.js';
import { alertMismatchSentence } from '../../../domain/presentation/alerts.js';
import { siteLabel } from '../../../domain/sites/catalog.js';
import type { OverviewResponse } from '../../../shared/api.js';
import { sourceRunDto } from './sourceRun.js';

const alertIssueText = (issue: AlertIssue): string => `${siteLabel(issue.site)} : ${alertMismatchSentence(issue.mismatch)}`;

export const overviewDto = (overview: Overview): OverviewResponse => ({
  counts: overview.counts,
  week: overview.week,
  dealer: overview.dealer,
  zone: overview.zone,
  imapConfigured: overview.imapConfigured,
  alertsDone: overview.alertsDone,
  alertIssues: overview.alertIssues.map(alertIssueText),
  sources: overview.sources.map(sourceRunDto),
  pushKey: overview.pushKey,
});
