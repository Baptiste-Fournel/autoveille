import { formatInteger } from '../presentation/numbers.js';
import { formatPrice } from '../presentation/prices.js';
import type { Dealer } from '../settings/types.js';

export type MessageVars = {
  readonly marque: string;
  readonly modele: string;
  readonly annee: string;
  readonly km: string;
  readonly prix: string;
  readonly ville: string;
  readonly site: string;
  readonly distance: string;
  readonly prenom: string;
  readonly nom: string;
  readonly concession: string;
  readonly ville_concession: string;
  readonly telephone: string;
};

export type MessageVariable = keyof MessageVars;

export interface ListingForMessage {
  readonly title: string;
  readonly siteLabel: string;
  readonly city?: string | null;
}

export interface VehicleForMessage {
  readonly make?: string | null;
  readonly model?: string | null;
  readonly year?: number | null;
  readonly km?: number | null;
  readonly price?: number | null;
}

const isAbsent = (value: number | null | undefined): value is null | undefined => value === undefined || value === null;

export function buildVars(listing: ListingForMessage, vehicle: VehicleForMessage, dealer: Dealer, distanceKm: number | null): MessageVars {
  return {
    marque: vehicle.make ?? '',
    modele: [vehicle.make, vehicle.model].filter(Boolean).join(' ') || listing.title,
    annee: vehicle.year ? String(vehicle.year) : '',
    km: isAbsent(vehicle.km) ? '' : formatInteger(vehicle.km),
    prix: isAbsent(vehicle.price) ? '' : formatPrice(vehicle.price),
    ville: listing.city ?? '',
    site: listing.siteLabel,
    distance: isAbsent(distanceKm) ? '' : String(Math.round(distanceKm)),
    prenom: dealer.firstName,
    nom: dealer.lastName,
    concession: dealer.company,
    ville_concession: dealer.city,
    telephone: dealer.phone,
  };
}
