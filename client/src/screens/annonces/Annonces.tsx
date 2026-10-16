import type { JSX } from 'preact';
import { useRef } from 'preact/hooks';
import type { ListedStatus, RejectedKind, RejectedKindCountsDto } from '../../../../src/shared/api';
import { useAppState } from '../../app/AppContext';
import { FilterBar } from '../../components/FilterBar';
import { SetupCard } from '../../components/SetupCard';
import { VehicleCard } from '../../components/VehicleCard';
import { filteredVehicles } from '../../listFilters/filteredVehicles';
import { useListFilters } from '../../listFilters/useListFilters';
import { AlertIssues } from './AlertIssues';
import { AnnoncesHeadline } from './AnnoncesHeadline';
import { EmptyList } from './EmptyList';
import { RejectedKinds } from './RejectedKinds';
import { StatusTabs } from './StatusTabs';

const NOTHING_MATCHES_TEXT = 'Aucune annonce ne correspond à ces filtres.';

export const Annonces = (): JSX.Element | null => {
  const { overview, vehicles, preferences, refresh } = useAppState();
  const { filters, change } = useListFilters(preferences);
  const lastKinds = useRef<RejectedKindCountsDto | null>(null);
  const summary = overview.data.value;
  const selected = vehicles.selected.value;
  const list = vehicles.current.value;
  const search = vehicles.search.value;
  const now = refresh.now.value;
  lastKinds.current = list.kinds ?? lastKinds.current;
  if (summary === null) {
    return null;
  }
  const shown = filteredVehicles(list.vehicles, filters, search);
  const selectStatus = (status: ListedStatus): void => void vehicles.select({ status, kind: selected.kind });
  const selectKind = (kind: RejectedKind): void => void vehicles.select({ status: 'ecartees', kind });
  const handling = selected.status === 'nouveau';
  return (
    <>
      <AnnoncesHeadline overview={summary} status={selected.status} now={now} />
      {handling ? <SetupCard overview={summary} /> : null}
      {handling ? <AlertIssues alertIssues={summary.alertIssues} /> : null}
      <StatusTabs counts={summary.counts} selected={selected.status} onSelect={selectStatus} />
      {selected.status === 'ecartees' ? <RejectedKinds counts={lastKinds.current} selected={selected.kind} onSelect={selectKind} /> : null}
      {list.vehicles.length ? <FilterBar vehicles={list.vehicles} filters={filters} onFilters={change} shownCount={shown.length} /> : null}
      <div class="stack">
        {list.loaded && !list.vehicles.length ? <EmptyList status={selected.status} imapConfigured={summary.imapConfigured} /> : null}
        {shown.map((vehicle) => (
          <VehicleCard key={vehicle.id} vehicle={vehicle} />
        ))}
        {list.vehicles.length && !shown.length ? <p class="muted small">{NOTHING_MATCHES_TEXT}</p> : null}
        {list.nextCursor === null ? null : (
          <button class="btn more" type="button" disabled={list.loadingMore} onClick={() => void vehicles.loadMore()}>
            Charger plus
          </button>
        )}
      </div>
    </>
  );
};
