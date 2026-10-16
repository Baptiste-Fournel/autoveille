import type { RawListing, Vehicle } from '../vehicle/types.js';
import { vehicleName } from '../vehicle/vehicleName.js';
import { formatMileage } from './mileages.js';
import { formatPrice } from './prices.js';

export interface NotificationText {
  readonly title: string;
  readonly body: string;
}

export type NotifiedVehicle = Pick<Vehicle, 'make' | 'model' | 'year' | 'km' | 'price' | 'distanceKm' | 'status'>;

export type NotifiedListing = Pick<RawListing, 'title' | 'city' | 'siteLabel'>;

const factsOf = (vehicle: NotifiedVehicle): string =>
  [
    vehicle.year ? String(vehicle.year) : '',
    vehicle.km !== null ? formatMileage(vehicle.km) : '',
    vehicle.price !== null ? formatPrice(vehicle.price) : '',
  ]
    .filter(Boolean)
    .join(', ');

const whereOf = (vehicle: NotifiedVehicle, listing: NotifiedListing): string =>
  [listing.city, vehicle.distanceKm !== null ? `à ${Math.round(vehicle.distanceKm)} km` : ''].filter(Boolean).join(', ');

export function newVehicleText(vehicle: NotifiedVehicle, listing: NotifiedListing): NotificationText {
  const where = whereOf(vehicle, listing);
  return {
    title: `Nouvelle annonce : ${vehicleName(vehicle, listing.title)}`,
    body: `${factsOf(vehicle)}${where ? ` • ${where}` : ''} • ${listing.siteLabel}`,
  };
}

export function priceDropText(vehicle: NotifiedVehicle, listing: NotifiedListing, from: number, to: number): NotificationText {
  return {
    title: `Prix baissé : ${vehicleName(vehicle, listing.title)}`,
    body: `${formatPrice(from)} → ${formatPrice(to)}${vehicle.status === 'contacte' ? ' • vendeur déjà contacté' : ''} • ${listing.siteLabel}`,
  };
}

export function truncatedDigestText(siteLabel: string, announced: number, received: number): NotificationText {
  const missing = announced - received;
  return {
    title: `${siteLabel} : ${announced} nouvelles annonces`,
    body: `${received} ${received > 1 ? 'arrivées' : 'arrivée'} dans l’application, ${missing} ${missing > 1 ? 'autres sont à voir' : 'autre est à voir'} sur le site.`,
  };
}
