import type { SettingsRepository } from '../ports/settingsRepository.js';
import type { VehicleRepository } from '../ports/vehicleRepository.js';
import { existingVehicle } from './existingVehicle.js';
import { type SheetReader, type VehicleSheet, vehicleSheet } from './vehicleSheet.js';

export interface GetVehiclePorts {
  readonly vehicles: SheetReader & Pick<VehicleRepository, 'vehicle'>;
  readonly settings: Pick<SettingsRepository, 'load'>;
}

export function getVehicle(ports: GetVehiclePorts, id: number): VehicleSheet {
  const vehicle = existingVehicle(ports.vehicles, id);
  return vehicleSheet(ports.vehicles, vehicle, ports.settings.load());
}
