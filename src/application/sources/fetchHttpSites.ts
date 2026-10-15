import { httpSitePassDetail } from '../../domain/presentation/httpSites.js';
import type { HttpSite } from '../../domain/settings/types.js';
import type { IngestDependencies } from '../ingest/ingestListing.js';
import type { SourceRunRepository } from '../ports/sourceRunRepository.js';
import { ingestInTurn } from './ingestInTurn.js';
import { type ReadSitePageDependencies, readSitePage } from './readSitePage.js';
import type { SourceRunSummary } from './sourceRunSummary.js';

export interface FetchHttpSitesDependencies extends IngestDependencies, ReadSitePageDependencies {
  readonly sourceRuns: SourceRunRepository;
}

export interface HttpSitesFetching {
  readonly fetchAll: () => Promise<readonly SourceRunSummary[]>;
}

const NO_RUN: readonly SourceRunSummary[] = [];

const fetchSite = async (dependencies: FetchHttpSitesDependencies, site: HttpSite): Promise<SourceRunSummary> => {
  const reading = await readSitePage(dependencies, site.url);
  const matched = await ingestInTurn(dependencies, reading.listings);
  const detail = reading.ok ? httpSitePassDetail(reading.detail, matched) : reading.detail;
  dependencies.sourceRuns.record({ source: `http:${site.id}`, lastRunAt: dependencies.clock.now(), ok: reading.ok, detail });
  return { source: site.name, ok: reading.ok, detail };
};

export const fetchHttpSites = async (dependencies: FetchHttpSitesDependencies): Promise<readonly SourceRunSummary[]> => {
  const sites = dependencies.settings.load().httpSites.filter((site) => site.enabled && site.url);
  let summaries = NO_RUN;
  for (const site of sites) {
    summaries = [...summaries, await fetchSite(dependencies, site)];
  }
  return summaries;
};

export const httpSitesFetching = (dependencies: FetchHttpSitesDependencies): HttpSitesFetching => {
  let busy = false;
  return {
    fetchAll: async () => {
      if (busy) {
        return NO_RUN;
      }
      busy = true;
      try {
        return await fetchHttpSites(dependencies);
      } finally {
        busy = false;
      }
    },
  };
};
