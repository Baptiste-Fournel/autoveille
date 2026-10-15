import type { Family } from '../catalog/families.js';
import type { RejectionReason } from '../filtering/verdict.js';
import type { VehicleEventType } from './events.js';

export type SellerType = 'particulier' | 'pro' | 'inconnu';

export type Status = 'nouveau' | 'contacte' | 'repondu' | 'ignore';

export interface RawListing {
  readonly site: string;
  readonly siteLabel: string;
  readonly externalId: string;
  readonly url: string;
  readonly title: string;
  readonly price?: number;
  readonly km?: number;
  readonly year?: number;
  readonly city?: string;
  readonly postalCode?: string;
  readonly sellerType?: SellerType;
  readonly description?: string;
  readonly imageUrl?: string;
  readonly publishedAt?: string;
  readonly sourceRef?: string;
}

export interface VehicleInfo {
  readonly make?: string;
  readonly model?: string;
  readonly family: Family;
  readonly year?: number;
  readonly km?: number;
  readonly price?: number;
}

export interface Vehicle {
  readonly id: number;
  readonly fingerprint: string;
  readonly make: string | null;
  readonly model: string | null;
  readonly family: Family;
  readonly year: number | null;
  readonly km: number | null;
  readonly price: number | null;
  readonly city: string | null;
  readonly postalCode: string | null;
  readonly lat: number | null;
  readonly lon: number | null;
  readonly distanceKm: number | null;
  readonly status: Status;
  readonly doNotContact: boolean;
  readonly matched: boolean;
  readonly rejections: readonly RejectionReason[];
  readonly messageOverride: string | null;
  readonly note: string | null;
  readonly firstSeenAt: string;
  readonly lastSeenAt: string;
  readonly publishedAt: string | null;
  readonly notifiedAt: string | null;
  readonly priceDropped: boolean;
  readonly reposted: boolean;
}

export interface Listing {
  readonly id: number;
  readonly vehicleId: number;
  readonly site: string;
  readonly siteLabel: string;
  readonly externalId: string;
  readonly url: string;
  readonly title: string;
  readonly price: number | null;
  readonly km: number | null;
  readonly year: number | null;
  readonly city: string | null;
  readonly postalCode: string | null;
  readonly sellerType: SellerType;
  readonly imageUrl: string | null;
  readonly description: string | null;
  readonly publishedAt: string | null;
  readonly sourceRef: string | null;
  readonly firstSeenAt: string;
  readonly lastSeenAt: string;
}

export interface PricePoint {
  readonly price: number;
  readonly seenAt: string;
}

export interface VehicleEvent {
  readonly id: number;
  readonly vehicleId: number;
  readonly type: VehicleEventType;
  readonly detail: string | null;
  readonly at: string;
}
