import { type ImportedListing, listingFromImport } from '../../domain/ingest/imports.js';
import type { Settings } from '../../domain/settings/types.js';
import { type IngestDependencies, ingestListing } from './ingestListing.js';

export interface ImportRequest {
  readonly items: readonly ImportedListing[];
  readonly notify: boolean;
}

export interface ImportSummary {
  readonly received: number;
  readonly new: number;
  readonly matched: number;
  readonly seen: number;
  readonly skipped: number;
}

export class NothingToImport extends Error {
  constructor() {
    super('nothing to import');
    this.name = 'NothingToImport';
  }
}

export const IMPORT_LIMIT = 500;

type ItemResult = 'new' | 'matched' | 'seen' | 'skipped';

const counted = (summary: ImportSummary, result: ItemResult): ImportSummary => {
  switch (result) {
    case 'matched':
      return { ...summary, new: summary.new + 1, matched: summary.matched + 1 };
    case 'new':
      return { ...summary, new: summary.new + 1 };
    case 'seen':
      return { ...summary, seen: summary.seen + 1 };
    case 'skipped':
      return { ...summary, skipped: summary.skipped + 1 };
  }
};

const imported = async (
  dependencies: IngestDependencies,
  settings: Settings,
  item: ImportedListing,
  notify: boolean,
): Promise<ItemResult> => {
  const listing = listingFromImport(item);
  if (listing === undefined) {
    return 'skipped';
  }
  try {
    const outcome = await ingestListing(dependencies, { listing, settings, notify, aboutOlderAds: false });
    if (outcome.kind !== 'created') {
      return 'seen';
    }
    return outcome.verdict.pass ? 'matched' : 'new';
  } catch {
    return 'skipped';
  }
};

export async function importListings(dependencies: IngestDependencies, request: ImportRequest): Promise<ImportSummary> {
  const items = request.items.slice(0, IMPORT_LIMIT);
  if (items.length === 0) {
    throw new NothingToImport();
  }
  const settings = dependencies.settings.load();
  const start: ImportSummary = { received: items.length, new: 0, matched: 0, seen: 0, skipped: 0 };
  return items.reduce<Promise<ImportSummary>>(
    async (previous, item) => counted(await previous, await imported(dependencies, settings, item, request.notify)),
    Promise.resolve(start),
  );
}
