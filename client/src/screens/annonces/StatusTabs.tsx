import type { JSX } from 'preact';
import type { ListedStatus, StatusCountsDto } from '../../../../src/shared/api';
import { LISTED_STATUSES } from './listedStatuses';

export interface StatusTabsProps {
  readonly counts: StatusCountsDto;
  readonly selected: ListedStatus;
  readonly onSelect: (status: ListedStatus) => void;
}

export const StatusTabs = ({ counts, selected, onSelect }: StatusTabsProps): JSX.Element => (
  <div class="filterbar">
    {LISTED_STATUSES.map((tab) => {
      const count = tab.counted === null ? 0 : counts[tab.counted];
      return (
        <button key={tab.status} class="chip" type="button" aria-pressed={selected === tab.status} onClick={() => onSelect(tab.status)}>
          {tab.label}
          {count ? <span class="badge count">{count}</span> : null}
        </button>
      );
    })}
  </div>
);
