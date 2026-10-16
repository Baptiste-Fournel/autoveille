import { evaluate } from '../filtering/evaluate.js';
import { haversineKm } from '../geo/distance.js';
import { type ExtractionContext, extractVehicleInfo } from '../parsing/vehicleInfo.js';
import type { Settings } from '../settings/types.js';
import { rawListingOf } from '../vehicle/rawListingOf.js';
import type { Listing, Vehicle, VehicleInfo } from '../vehicle/types.js';
import { zoneCenter } from './location.js';

export type VehicleReevaluation = Pick<Vehicle, 'matched' | 'rejections' | 'distanceKm' | 'make' | 'model' | 'family'>;

const distanceFromZone = (vehicle: Vehicle, settings: Settings): number | null => {
  const center = zoneCenter(settings.zone);
  return vehicle.lat !== null && vehicle.lon !== null && center !== undefined
    ? haversineKm(center, { lat: vehicle.lat, lon: vehicle.lon })
    : vehicle.distanceKm;
};

export function reevaluationOf(
  vehicle: Vehicle,
  firstListing: Listing,
  settings: Settings,
  context: ExtractionContext,
): VehicleReevaluation {
  const raw = rawListingOf(vehicle, firstListing);
  const fresh = extractVehicleInfo(raw, context);
  const info: VehicleInfo = {
    make: fresh.make ?? vehicle.make ?? undefined,
    model: fresh.model ?? vehicle.model ?? undefined,
    family: fresh.make ? fresh.family : vehicle.family,
    year: vehicle.year ?? undefined,
    km: vehicle.km ?? undefined,
    price: vehicle.price ?? undefined,
  };
  const distanceKm = distanceFromZone(vehicle, settings);
  const verdict = evaluate(raw, info, settings, distanceKm);
  return {
    matched: verdict.pass,
    rejections: verdict.rejections,
    distanceKm,
    make: info.make ?? null,
    model: info.model ?? null,
    family: info.family,
  };
}
