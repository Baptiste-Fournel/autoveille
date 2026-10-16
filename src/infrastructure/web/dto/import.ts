import type { ImportRequest as ImportListingsRequest, ImportSummary } from '../../../application/ingest/importListings.js';
import type { PublishedDatesSummary } from '../../../application/ingest/recordPublishedDates.js';
import type { ImportedPublicationDate } from '../../../domain/ingest/imports.js';
import type {
  ImportRequest,
  ImportResponse,
  ImportTokenResponse,
  PublishedDatesRequest,
  PublishedDatesResponse,
} from '../../../shared/api.js';

export const importTokenDto = (token: string): ImportTokenResponse => ({ token });

export const importListingsRequestOf = (body: ImportRequest): ImportListingsRequest => ({
  items: body.listings ?? [],
  notify: body.notify ?? false,
});

export const importSummaryDto = (summary: ImportSummary): ImportResponse => ({
  received: summary.received,
  new: summary.new,
  matched: summary.matched,
  seen: summary.seen,
  skipped: summary.skipped,
});

export const publishedDatesOf = (body: PublishedDatesRequest): readonly ImportedPublicationDate[] => body.items ?? [];

export const publishedDatesSummaryDto = (summary: PublishedDatesSummary): PublishedDatesResponse => ({
  received: summary.received,
  updated: summary.updated,
  unknown: summary.unknown,
  skipped: summary.skipped,
});
