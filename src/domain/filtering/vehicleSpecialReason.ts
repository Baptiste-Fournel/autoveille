import type { Settings } from '../settings/types.js';
import type { Listing, Vehicle } from '../vehicle/types.js';
import { specialReason } from './evaluate.js';
import type { SpecialReason } from './verdict.js';

export type VehicleToJudge = Pick<Vehicle, 'make' | 'model' | 'family' | 'year' | 'km' | 'price'>;

export function vehicleSpecialReason(
  vehicle: VehicleToJudge,
  firstListing: Pick<Listing, 'title'> | undefined,
  settings: Pick<Settings, 'families'>,
): SpecialReason | undefined {
  if (firstListing === undefined || vehicle.family === 'autres') {
    return undefined;
  }
  const info = {
    make: vehicle.make ?? undefined,
    model: vehicle.model ?? undefined,
    family: vehicle.family,
    year: vehicle.year ?? undefined,
    km: vehicle.km ?? undefined,
    price: vehicle.price ?? undefined,
  };
  return specialReason(settings.families[vehicle.family], info, firstListing);
}
