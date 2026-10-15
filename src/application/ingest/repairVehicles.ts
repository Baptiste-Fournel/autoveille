import { regroupListings, type SeparatedListings, type SeparatedVehicle, vehicleOfSeparatedListings } from '../../domain/ingest/regroup.js';
import { extractionContextAt } from '../../domain/parsing/extractionContext.js';
import type { ExtractionContext } from '../../domain/parsing/vehicleInfo.js';
import type { Settings } from '../../domain/settings/types.js';
import type { Vehicle } from '../../domain/vehicle/types.js';
import type { Clock } from '../ports/clock.js';
import type { Geocoder } from '../ports/geocoder.js';
import type { SettingsRepository } from '../ports/settingsRepository.js';
import type { Transaction } from '../ports/transaction.js';
import type { VehicleRepository } from '../ports/vehicleRepository.js';
import { locateListing } from './listingLocation.js';

export interface RepairDependencies {
  readonly vehicles: VehicleRepository;
  readonly settings: SettingsRepository;
  readonly transaction: Transaction;
  readonly geocoder: Geocoder;
  readonly clock: Clock;
}

export interface RepairSummary {
  readonly vehicles: number;
  readonly renamed: number;
  readonly split: number;
  readonly reevaluated: number;
}

interface RepairPass {
  readonly dependencies: RepairDependencies;
  readonly settings: Settings;
  readonly context: ExtractionContext;
}

const NOTHING_REPAIRED: RepairSummary = { vehicles: 0, renamed: 0, split: 0, reevaluated: 0 };

const sum = (a: RepairSummary, b: RepairSummary): RepairSummary => ({
  vehicles: a.vehicles + b.vehicles,
  renamed: a.renamed + b.renamed,
  split: a.split + b.split,
  reevaluated: a.reevaluated + b.reevaluated,
});

const separatedVehicles = async (pass: RepairPass, groups: readonly SeparatedListings[]): Promise<readonly SeparatedVehicle[]> => {
  const [group, ...others] = groups;
  if (group === undefined) {
    return [];
  }
  const location = await locateListing(pass.dependencies.geocoder, pass.settings.zone, group.anchor.raw);
  return [vehicleOfSeparatedListings(group, location, pass.settings), ...(await separatedVehicles(pass, others))];
};

const repaired = async (pass: RepairPass, vehicle: Vehicle): Promise<RepairSummary> => {
  const { vehicles, transaction } = pass.dependencies;
  const regrouping = regroupListings(vehicle, vehicles.listingsOf(vehicle.id), pass.settings, pass.context);
  if (regrouping === undefined) {
    return { ...NOTHING_REPAIRED, vehicles: 1 };
  }
  const separated = await separatedVehicles(pass, regrouping.separated);
  transaction.run(() => {
    vehicles.applyRegrouping(vehicle.id, regrouping.vehicleChanges);
    for (const car of separated) {
      const carId = vehicles.addVehicle(car.vehicle);
      vehicles.moveListings(car.listingIds, carId);
      vehicles.addEvent(carId, car.event);
    }
  });
  return {
    vehicles: 1,
    renamed: regrouping.renamed ? 1 : 0,
    split: separated.length,
    reevaluated: regrouping.reevaluated ? 1 : 0,
  };
};

export async function repairVehicles(dependencies: RepairDependencies): Promise<RepairSummary> {
  const settings = dependencies.settings.load();
  const pass: RepairPass = { dependencies, settings, context: extractionContextAt(settings, dependencies.clock.now()) };
  return dependencies.vehicles
    .allVehicles()
    .reduce<Promise<RepairSummary>>(
      async (previous, vehicle) => sum(await previous, await repaired(pass, vehicle)),
      Promise.resolve(NOTHING_REPAIRED),
    );
}
