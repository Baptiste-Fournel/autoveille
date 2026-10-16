import type { ListedStatus, Status } from '../../../../src/shared/api';

export interface ListedStatusTab {
  readonly status: ListedStatus;
  readonly label: string;
  readonly counted: Status | null;
}

export const LISTED_STATUSES: readonly ListedStatusTab[] = [
  { status: 'nouveau', label: 'À traiter', counted: 'nouveau' },
  { status: 'contacte', label: 'Contactées', counted: 'contacte' },
  { status: 'repondu', label: 'Ont répondu', counted: 'repondu' },
  { status: 'ignore', label: 'Ignorées', counted: 'ignore' },
  { status: 'ecartees', label: 'Écartées par les filtres', counted: null },
  { status: 'tous', label: 'Toutes', counted: null },
];

export const listedStatusLabel = (status: ListedStatus): string => LISTED_STATUSES.find((tab) => tab.status === status)?.label ?? '';
