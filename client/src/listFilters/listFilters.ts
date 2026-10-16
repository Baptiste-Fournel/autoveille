export type SortKey = 'recent' | 'priceDesc' | 'priceAsc' | 'near' | 'kmAsc';

export interface ListFilters {
  readonly sort: SortKey;
  readonly families: readonly string[];
  readonly sites: readonly string[];
  readonly priceMin: number | null;
  readonly priceMax: number | null;
  readonly distMax: number | null;
}

export const DEFAULT_LIST_FILTERS: ListFilters = { sort: 'recent', families: [], sites: [], priceMin: null, priceMax: null, distMax: null };

export const SORT_OPTIONS: readonly (readonly [SortKey, string])[] = [
  ['recent', 'Plus récentes'],
  ['priceDesc', 'Prix décroissant'],
  ['priceAsc', 'Prix croissant'],
  ['near', 'Les plus proches'],
  ['kmAsc', 'Moins de km'],
];

export const activeFilterCount = (filters: ListFilters): number =>
  (filters.families.length ? 1 : 0) +
  (filters.sites.length ? 1 : 0) +
  (filters.priceMin || filters.priceMax ? 1 : 0) +
  (filters.distMax ? 1 : 0) +
  (filters.sort !== 'recent' ? 1 : 0);
