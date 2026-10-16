export interface BurstProgress {
  readonly ids: readonly number[];
  readonly index: number;
  readonly sent: number;
  readonly ignored: number;
  readonly skipped: number;
}
