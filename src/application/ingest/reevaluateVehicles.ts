import { reevaluationOf, type VehicleReevaluation } from '../../domain/ingest/reevaluate.js';
import { extractionContextAt } from '../../domain/parsing/extractionContext.js';
import type { Settings } from '../../domain/settings/types.js';
import { daysBefore } from '../../domain/time/daysBefore.js';
import type { Clock } from '../ports/clock.js';
import type { Transaction } from '../ports/transaction.js';
import type { VehicleRepository } from '../ports/vehicleRepository.js';

export interface ReevaluationDependencies {
  readonly vehicles: VehicleRepository;
  readonly transaction: Transaction;
  readonly clock: Clock;
}

export interface ReevaluationRequest {
  readonly settings: Settings;
  readonly persist: boolean;
}

export interface ReevaluationPreview {
  readonly total: number;
  readonly pass: number;
}

const REEVALUATION_WINDOW_DAYS = 7;

interface Reevaluated {
  readonly vehicleId: number;
  readonly reevaluation: VehicleReevaluation;
}

export function reevaluateVehicles(dependencies: ReevaluationDependencies, request: ReevaluationRequest): ReevaluationPreview {
  const { vehicles } = dependencies;
  const now = dependencies.clock.now();
  const recent = vehicles.vehiclesFirstSeenSince(daysBefore(now, REEVALUATION_WINDOW_DAYS));
  const context = extractionContextAt(request.settings, now);
  const reevaluated = recent.flatMap((vehicle): readonly Reevaluated[] => {
    const [firstListing] = vehicles.listingsOf(vehicle.id);
    return firstListing === undefined
      ? []
      : [{ vehicleId: vehicle.id, reevaluation: reevaluationOf(vehicle, firstListing, request.settings, context) }];
  });
  if (request.persist) {
    dependencies.transaction.run(() => {
      for (const { vehicleId, reevaluation } of reevaluated) {
        vehicles.applyReevaluation(vehicleId, reevaluation);
      }
    });
  }
  return { total: recent.length, pass: reevaluated.filter(({ reevaluation }) => reevaluation.matched).length };
}
