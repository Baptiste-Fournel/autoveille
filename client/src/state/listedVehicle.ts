import type { VehicleDto } from '../../../src/shared/api';

const isListed = (vehicle: VehicleDto): boolean =>
  vehicle.events.length === 0 && vehicle.listings.every((listing) => listing.priceHistory.length === 0);

export const listedVehicle = (vehicle: VehicleDto): VehicleDto =>
  isListed(vehicle) ? vehicle : { ...vehicle, listings: vehicle.listings.map((listing) => ({ ...listing, priceHistory: [] })), events: [] };
