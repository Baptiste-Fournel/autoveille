export type SourceId = 'email' | `http:${string}`;

export interface SourceRun {
  readonly source: SourceId;
  readonly lastRunAt: string;
  readonly ok: boolean;
  readonly detail: string;
}

export interface SourceRunRepository {
  record(run: SourceRun): void;
  all(): readonly SourceRun[];
}
