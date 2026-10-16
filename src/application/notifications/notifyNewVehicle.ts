import type { RawListing, Vehicle } from '../../domain/vehicle/types.js';
import { newVehicleNotification } from './content.js';
import { publicAddress } from './publicAddress.js';
import { type NotificationDependencies, sendToChannels } from './sendToChannels.js';

export interface NewVehicleNotice {
  readonly vehicle: Vehicle;
  readonly listing: RawListing;
}

export async function notifyNewVehicle(dependencies: NotificationDependencies, notice: NewVehicleNotice): Promise<void> {
  const baseUrl = publicAddress(dependencies.secrets, dependencies.address);
  await sendToChannels(dependencies, newVehicleNotification(notice.vehicle, notice.listing, baseUrl));
}
