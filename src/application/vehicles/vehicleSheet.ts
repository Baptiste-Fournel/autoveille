import type { Settings } from '../../domain/settings/types.js';
import type { PricePoint, Vehicle, VehicleEvent } from '../../domain/vehicle/types.js';
import type { VehicleRepository } from '../ports/vehicleRepository.js';
import { type CardReader, type VehicleCard, vehicleCard } from './vehicleCard.js';

export interface VehicleSheet extends VehicleCard {
  readonly priceHistories: ReadonlyMap<number, readonly PricePoint[]>;
  readonly events: readonly VehicleEvent[];
}

export type SheetReader = CardReader & Pick<VehicleRepository, 'priceHistory' | 'events'>;

export function vehicleSheet(vehicles: SheetReader, vehicle: Vehicle, settings: Settings): VehicleSheet {
  const card = vehicleCard(vehicles, vehicle, settings);
  return {
    ...card,
    priceHistories: new Map(card.listings.map((listing) => [listing.id, vehicles.priceHistory(listing.id)])),
    events: vehicles.events(vehicle.id),
  };
}
