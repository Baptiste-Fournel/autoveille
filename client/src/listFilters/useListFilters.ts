import { useState } from 'preact/hooks';
import type { DevicePreferences } from '../storage/preferences';
import type { ListFilters } from './listFilters';
import { listFiltersFrom } from './storedListFilters';

export interface RememberedListFilters {
  readonly filters: ListFilters;
  readonly change: (filters: ListFilters) => void;
}

export const useListFilters = (preferences: DevicePreferences): RememberedListFilters => {
  const [filters, setFilters] = useState(() => listFiltersFrom(preferences.get('filters')));
  return {
    filters,
    change: (next) => {
      setFilters(next);
      preferences.set('filters', JSON.stringify(next));
    },
  };
};
