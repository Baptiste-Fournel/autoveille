import type { SiteDef } from '../../domain/sites/catalog.js';

export interface ReadingContext {
  readonly emailSite?: SiteDef;
  readonly resolvedLinks: ReadonlyMap<string, string>;
  readonly sourceRef?: string;
  readonly maxYear: number;
}
