import type { Vehicle } from '../../domain/vehicle/types.js';
import type { VehicleRepository } from '../ports/vehicleRepository.js';
import { VehicleNotFound } from './vehicleNotFound.js';

export function existingVehicle(vehicles: Pick<VehicleRepository, 'vehicle'>, id: number): Vehicle {
  const vehicle = vehicles.vehicle(id);
  if (vehicle === undefined) {
    throw new VehicleNotFound(id);
  }
  return vehicle;
}
