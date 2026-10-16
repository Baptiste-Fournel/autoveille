import { isRecord } from '../guards/isRecord';
import { DEFAULT_LIST_FILTERS, type ListFilters, SORT_OPTIONS, type SortKey } from './listFilters';

const parsedOrNull = (text: string): unknown => {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
};

const sortIn = (value: unknown): SortKey => SORT_OPTIONS.find(([key]) => key === value)?.[0] ?? DEFAULT_LIST_FILTERS.sort;

const textsIn = (value: unknown): readonly string[] =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];

const amountIn = (value: unknown): number | null => (typeof value === 'number' && Number.isFinite(value) ? value : null);

export const listFiltersFrom = (stored: string | null): ListFilters => {
  const parsed = stored === null ? null : parsedOrNull(stored);
  if (!isRecord(parsed)) {
    return DEFAULT_LIST_FILTERS;
  }
  return {
    sort: sortIn(parsed.sort),
    families: textsIn(parsed.families),
    sites: textsIn(parsed.sites),
    priceMin: amountIn(parsed.priceMin),
    priceMax: amountIn(parsed.priceMax),
    distMax: amountIn(parsed.distMax),
  };
};
