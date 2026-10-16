import { type ReadonlySignal, signal } from '@preact/signals';
import type { OverviewResponse, VehicleDto } from '../../../src/shared/api';
import type { ApiClient } from '../api/client';
import { shiftedCounts } from './statusCounts';

export interface Overview {
  readonly data: ReadonlySignal<OverviewResponse | null>;
  readonly refresh: () => Promise<void>;
  readonly shift: (before: VehicleDto, after: VehicleDto) => void;
}

export const createOverview = (api: ApiClient): Overview => {
  const data = signal<OverviewResponse | null>(null);
  let etag: string | null = null;
  return {
    data,
    refresh: async () => {
      try {
        const answer = await api.overviewIfChanged(etag);
        if (answer.changed) {
          data.value = answer.body;
          etag = answer.etag;
        }
      } catch {
        return;
      }
    },
    shift: (before, after) => {
      const shown = data.value;
      if (shown !== null) {
        data.value = { ...shown, counts: shiftedCounts(shown.counts, before, after) };
        etag = null;
      }
    },
  };
};
