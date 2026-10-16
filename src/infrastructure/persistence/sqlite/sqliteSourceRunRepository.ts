import type Database from 'better-sqlite3';
import type { SourceRun, SourceRunRepository } from '../../../application/ports/sourceRunRepository.js';
import { type SourceRunRow, sourceRunOf, sourceRunRowOf } from './sourceRunMapper.js';

export class SqliteSourceRunRepository implements SourceRunRepository {
  private readonly upsertRun: Database.Statement<[SourceRunRow]>;
  private readonly selectRuns: Database.Statement<[], SourceRunRow>;

  constructor(database: Database.Database) {
    this.upsertRun = database.prepare<[SourceRunRow]>(
      `INSERT INTO source_runs (source, last_run_at, ok, detail) VALUES (@source, @last_run_at, @ok, @detail)
       ON CONFLICT (source) DO UPDATE SET last_run_at = excluded.last_run_at, ok = excluded.ok, detail = excluded.detail`,
    );
    this.selectRuns = database.prepare<[], SourceRunRow>('SELECT source, last_run_at, ok, detail FROM source_runs ORDER BY rowid');
  }

  record(run: SourceRun): void {
    this.upsertRun.run(sourceRunRowOf(run));
  }

  all(): readonly SourceRun[] {
    return this.selectRuns.all().map(sourceRunOf);
  }
}
