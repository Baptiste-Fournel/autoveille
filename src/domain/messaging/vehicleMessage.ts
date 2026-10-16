import type { Listing, Vehicle } from '../vehicle/types.js';
import { composeMessage, type MessageSettings } from './compose.js';

export type VehicleToContact = Pick<
  Vehicle,
  'messageOverride' | 'fingerprint' | 'distanceKm' | 'family' | 'make' | 'model' | 'year' | 'km' | 'price'
>;

export type FirstListing = Pick<Listing, 'title' | 'siteLabel' | 'city'>;

export function vehicleMessage(vehicle: VehicleToContact, firstListing: FirstListing | undefined, settings: MessageSettings): string {
  if (vehicle.messageOverride) {
    return vehicle.messageOverride;
  }
  if (firstListing === undefined) {
    return '';
  }
  return composeMessage(firstListing, vehicle, settings, vehicle.fingerprint, vehicle.distanceKm);
}
