import type { MessageSettings } from '../../domain/messaging/compose.js';
import { type VehicleToContact, vehicleMessage } from '../../domain/messaging/vehicleMessage.js';
import type { Vehicle } from '../../domain/vehicle/types.js';
import type { VehicleRepository } from '../ports/vehicleRepository.js';

export interface MessageForPorts {
  readonly vehicles: Pick<VehicleRepository, 'listingsOf'>;
}

export function messageFor(ports: MessageForPorts, vehicle: VehicleToContact & Pick<Vehicle, 'id'>, settings: MessageSettings): string {
  return vehicleMessage(vehicle, ports.vehicles.listingsOf(vehicle.id)[0], settings);
}
