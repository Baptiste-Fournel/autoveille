import type { Vehicle } from '../vehicle/types.js';
import type { IngestDecision } from './decide.js';

export type IngestNotification = 'newVehicle' | 'priceDrop';

const notifiesPriceDrop = (vehicle: Pick<Vehicle, 'matched' | 'doNotContact' | 'status'>): boolean =>
  vehicle.matched && !vehicle.doNotContact && (vehicle.status === 'nouveau' || vehicle.status === 'contacte');

export function notificationFor(decision: IngestDecision): IngestNotification | undefined {
  switch (decision.kind) {
    case 'created':
      return decision.verdict.pass ? 'newVehicle' : undefined;
    case 'priceChanged':
      return decision.to < decision.from && notifiesPriceDrop(decision.vehicle) ? 'priceDrop' : undefined;
    case 'seenAgain':
    case 'attachedToVehicle':
      return undefined;
  }
}
