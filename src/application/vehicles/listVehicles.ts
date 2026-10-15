import type { RejectionGroup } from '../../domain/filtering/rejectionGroups.js';
import type { Settings } from '../../domain/settings/types.js';
import { daysBefore } from '../../domain/time/daysBefore.js';
import { isStatus } from '../../domain/vehicle/status.js';
import type { Status } from '../../domain/vehicle/types.js';
import type { Clock } from '../ports/clock.js';
import type { SettingsRepository } from '../ports/settingsRepository.js';
import type {
  RejectedCounts,
  VehicleCursor,
  VehiclePage,
  VehiclePageQuery,
  VehicleRepository,
  VehicleSelection,
} from '../ports/vehicleRepository.js';
import { type CardReader, type VehicleCard, vehicleCard } from './vehicleCard.js';

const VEHICLE_PAGE_SIZE = 50;

const REJECTED_TAB = 'ecartees';

const ALL_KEPT_TAB = 'tous';

const DEFAULT_STATUS: Status = 'nouveau';

const REJECTED_WINDOW_DAYS = 14;

const DEFAULT_REJECTED_KIND = 'suivies';

const UNFOLLOWED_BRANDS_GROUP: RejectionGroup = 'marque';

export type RejectedKind = 'tous' | 'suivies' | RejectionGroup;

export type RejectedKindCounts = Readonly<Record<RejectedKind, number>>;

export interface ListVehiclesRequest {
  readonly status?: string;
  readonly kind?: RejectedKind;
  readonly days?: number;
  readonly after?: VehicleCursor;
  readonly limit?: number;
}

export interface VehicleList {
  readonly vehicles: readonly VehicleCard[];
  readonly nextCursor?: VehicleCursor;
  readonly rejectedCounts?: RejectedKindCounts;
}

export interface ListVehiclesPorts {
  readonly vehicles: CardReader & Pick<VehicleRepository, 'page' | 'rejectedCounts'>;
  readonly settings: Pick<SettingsRepository, 'load'>;
  readonly clock: Pick<Clock, 'now'>;
}

const keptStatus = (tab: string | undefined): Status | undefined => {
  if (tab === ALL_KEPT_TAB) {
    return undefined;
  }
  return tab !== undefined && isStatus(tab) ? tab : DEFAULT_STATUS;
};

const rejectedSelection = (kind: RejectedKind): VehicleSelection => {
  switch (kind) {
    case 'tous':
      return { kind: 'rejected' };
    case 'suivies':
      return { kind: 'rejected', withoutGroup: UNFOLLOWED_BRANDS_GROUP };
    default:
      return { kind: 'rejected', withGroup: kind };
  }
};

const countsByKind = (counts: RejectedCounts): RejectedKindCounts => ({
  tous: counts.all,
  suivies: counts.all - counts.byGroup[UNFOLLOWED_BRANDS_GROUP],
  loin: counts.byGroup.loin,
  km: counts.byGroup.km,
  special: counts.byGroup.special,
  pro: counts.byGroup.pro,
  marque: counts.byGroup.marque,
});

const cardsOf = (ports: ListVehiclesPorts, page: VehiclePage, settings: Settings): Pick<VehicleList, 'vehicles' | 'nextCursor'> => ({
  vehicles: page.vehicles.map((vehicle) => vehicleCard(ports.vehicles, vehicle, settings)),
  nextCursor: page.nextCursor,
});

export function listVehicles(ports: ListVehiclesPorts, request: ListVehiclesRequest = {}): VehicleList {
  const settings = ports.settings.load();
  const paging = { after: request.after, limit: request.limit ?? VEHICLE_PAGE_SIZE };
  if (request.status === REJECTED_TAB) {
    const firstSeenSince = daysBefore(ports.clock.now(), request.days ?? REJECTED_WINDOW_DAYS);
    const query: VehiclePageQuery = {
      selection: rejectedSelection(request.kind ?? DEFAULT_REJECTED_KIND),
      firstSeenSince,
      ...paging,
    };
    return {
      ...cardsOf(ports, ports.vehicles.page(query), settings),
      rejectedCounts: countsByKind(ports.vehicles.rejectedCounts(firstSeenSince)),
    };
  }
  const query: VehiclePageQuery = {
    selection: { kind: 'kept', status: keptStatus(request.status) },
    firstSeenSince: request.days === undefined ? undefined : daysBefore(ports.clock.now(), request.days),
    ...paging,
  };
  return cardsOf(ports, ports.vehicles.page(query), settings);
}
