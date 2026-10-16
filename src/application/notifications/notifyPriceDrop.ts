import type { RawListing, Vehicle } from '../../domain/vehicle/types.js';
import { priceDropNotification } from './content.js';
import { publicAddress } from './publicAddress.js';
import { type Delivery, type NotificationDependencies, sendToChannels } from './sendToChannels.js';

export interface PriceDropNotice {
  readonly vehicle: Vehicle;
  readonly listing: RawListing;
  readonly from: number;
  readonly to: number;
}

export async function notifyPriceDrop(dependencies: NotificationDependencies, notice: PriceDropNotice): Promise<Delivery> {
  const baseUrl = publicAddress(dependencies.secrets, dependencies.address);
  return sendToChannels(dependencies, priceDropNotification(notice.vehicle, notice.listing, notice.from, notice.to, baseUrl));
}
