import { planVehicleUpdate, UnknownStatus, type VehicleUpdateRequest } from '../../domain/vehicle/status.js';
import type { Clock } from '../ports/clock.js';
import type { Transaction } from '../ports/transaction.js';
import type { VehicleRepository } from '../ports/vehicleRepository.js';
import { existingVehicle } from './existingVehicle.js';
import { type GetVehiclePorts, getVehicle } from './getVehicle.js';
import type { VehicleSheet } from './vehicleSheet.js';

export interface UpdateVehiclePorts extends GetVehiclePorts {
  readonly vehicles: GetVehiclePorts['vehicles'] & Pick<VehicleRepository, 'eraseEvents' | 'addEvent' | 'applyVehicleUpdate'>;
  readonly clock: Pick<Clock, 'now'>;
  readonly transaction: Transaction;
}

export function updateVehicle(ports: UpdateVehiclePorts, id: number, request: VehicleUpdateRequest): VehicleSheet {
  const { vehicles } = ports;
  const update = planVehicleUpdate(existingVehicle(vehicles, id), request, ports.clock.now());
  if (update instanceof UnknownStatus) {
    throw update;
  }
  ports.transaction.run(() => {
    vehicles.eraseEvents(id, update.eventsToErase);
    for (const event of update.eventsToAdd) {
      vehicles.addEvent(id, event);
    }
    vehicles.applyVehicleUpdate(id, update.changes);
  });
  return getVehicle(ports, id);
}
