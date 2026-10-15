import type {
  AlertInfo as DomainAlertInfo,
  FamilyRules as DomainFamilyRules,
  MessageTemplate as DomainMessageTemplate,
  Settings as DomainSettings,
} from './domain/settings/types.js';
import type { RawListing as DomainRawListing, VehicleInfo as DomainVehicleInfo } from './domain/vehicle/types.js';

export type { Family } from './domain/catalog/families.js';
export { FOLLOWED_FAMILIES as FAMILIES } from './domain/catalog/families.js';
export { FAMILY_LABELS } from './domain/presentation/familyLabels.js';
export type { SellerType, Status } from './domain/vehicle/types.js';

type Writable<T> = { -readonly [K in keyof T]: T[K] extends readonly unknown[] ? T[K] : T[K] extends object ? Writable<T[K]> : T[K] };

export type RawListing = Writable<DomainRawListing>;
export type VehicleInfo = Writable<DomainVehicleInfo>;
export type Settings = Writable<DomainSettings>;
export type FamilyRules = Writable<DomainFamilyRules>;
export type MessageTemplate = Writable<DomainMessageTemplate>;
export type AlertInfo = Writable<DomainAlertInfo>;

export interface FilterResult {
  pass: boolean;
  reasons: string[];
  distanceKm?: number | null;
}
