import type { VehicleDto } from '../../../src/shared/api';
import { daysAgo } from './daysAgo';

export const followUpText = (vehicle: Pick<VehicleDto, 'status' | 'contactedAt' | 'repliedAt'>, now: number): string => {
  if (vehicle.status === 'repondu') {
    return vehicle.repliedAt ? `A répondu ${daysAgo(vehicle.repliedAt, now)}` : 'A répondu';
  }
  if (vehicle.status === 'contacte') {
    return vehicle.contactedAt ? `Contactée ${daysAgo(vehicle.contactedAt, now)}, sans réponse pour l’instant` : 'Contactée';
  }
  return '';
};
