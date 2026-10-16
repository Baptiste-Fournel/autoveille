import type { SourceRun } from '../../../application/ports/sourceRunRepository.js';
import type { SourceRunDto } from '../../../shared/api.js';

export const sourceRunDto = (run: SourceRun): SourceRunDto => ({
  source: run.source,
  last_run_at: run.lastRunAt,
  ok: run.ok ? 1 : 0,
  detail: run.detail,
});
