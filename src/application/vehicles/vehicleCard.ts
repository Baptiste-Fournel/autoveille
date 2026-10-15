import { vehicleSpecialReason } from '../../domain/filtering/vehicleSpecialReason.js';
import type { SpecialReason } from '../../domain/filtering/verdict.js';
import { vehicleMessage } from '../../domain/messaging/vehicleMessage.js';
import type { Settings } from '../../domain/settings/types.js';
import { EVENT_TYPES } from '../../domain/vehicle/events.js';
import type { Listing, Status, Vehicle } from '../../domain/vehicle/types.js';
import type { VehicleRepository } from '../ports/vehicleRepository.js';

export interface VehicleCard {
  readonly vehicle: Vehicle;
  readonly listings: readonly Listing[];
  readonly specialReason: SpecialReason | undefined;
  readonly message: string;
  readonly contactedAt: string | null;
  readonly repliedAt: string | null;
}

export type CardReader = Pick<VehicleRepository, 'listingsOf' | 'enteredStatusAt'>;

const STATUSES_AFTER_CONTACT: readonly Status[] = ['contacte', 'repondu'];

const contactedAt = (vehicles: CardReader, vehicle: Vehicle): string | null =>
  STATUSES_AFTER_CONTACT.includes(vehicle.status) ? vehicles.enteredStatusAt(vehicle.id, EVENT_TYPES.markedContacted) : null;

const repliedAt = (vehicles: CardReader, vehicle: Vehicle): string | null =>
  vehicle.status === 'repondu' ? vehicles.enteredStatusAt(vehicle.id, EVENT_TYPES.markedReplied) : null;

export function vehicleCard(vehicles: CardReader, vehicle: Vehicle, settings: Settings): VehicleCard {
  const listings = vehicles.listingsOf(vehicle.id);
  const firstListing = listings[0];
  return {
    vehicle,
    listings,
    specialReason: vehicleSpecialReason(vehicle, firstListing, settings),
    message: vehicleMessage(vehicle, firstListing, settings),
    contactedAt: contactedAt(vehicles, vehicle),
    repliedAt: repliedAt(vehicles, vehicle),
  };
}
