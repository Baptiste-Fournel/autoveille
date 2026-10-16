import type { VehicleDto } from '../../../src/shared/api';

const DEPARTMENT_CODE_LENGTH = 2;

export const locationText = (vehicle: Pick<VehicleDto, 'postalCode' | 'city' | 'distanceKm'>): string => {
  if (vehicle.postalCode && vehicle.postalCode.length <= DEPARTMENT_CODE_LENGTH) {
    return vehicle.city || `Dépt ${vehicle.postalCode}`;
  }
  return [vehicle.city, vehicle.distanceKm !== null ? `à ${vehicle.distanceKm} km` : null].filter(Boolean).join(', ');
};
