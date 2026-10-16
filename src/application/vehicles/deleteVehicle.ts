import type { VehicleRepository } from '../ports/vehicleRepository.js';
import { existingVehicle } from './existingVehicle.js';

export interface DeleteVehiclePorts {
  readonly vehicles: Pick<VehicleRepository, 'vehicle' | 'deleteVehicle'>;
}

export function deleteVehicle(ports: DeleteVehiclePorts, id: number): void {
  const vehicle = existingVehicle(ports.vehicles, id);
  ports.vehicles.deleteVehicle(vehicle.id);
}
