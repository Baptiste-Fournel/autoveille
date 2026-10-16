import type { SourceId, SourceRun } from '../../../application/ports/sourceRunRepository.js';

export interface SourceRunRow {
  readonly source: SourceId;
  readonly last_run_at: string;
  readonly ok: number;
  readonly detail: string;
}

export const sourceRunOf = (row: SourceRunRow): SourceRun => ({
  source: row.source,
  lastRunAt: row.last_run_at,
  ok: Boolean(row.ok),
  detail: row.detail,
});

export const sourceRunRowOf = (run: SourceRun): SourceRunRow => ({
  source: run.source,
  last_run_at: run.lastRunAt,
  ok: run.ok ? 1 : 0,
  detail: run.detail,
});
