import type { RawListing } from '../../domain/vehicle/types.js';
import { type IngestDependencies, type IngestOutcome, ingestListing } from '../ingest/ingestListing.js';

const isNewMatchedVehicle = (outcome: IngestOutcome): boolean => outcome.kind === 'created' && outcome.verdict.pass;

export const ingestInTurn = async (dependencies: IngestDependencies, listings: readonly RawListing[]): Promise<number> => {
  let newMatchedVehicles = 0;
  for (const listing of listings) {
    const outcome = await ingestListing(dependencies, { listing, settings: dependencies.settings.load(), notify: true });
    newMatchedVehicles += isNewMatchedVehicle(outcome) ? 1 : 0;
  }
  return newMatchedVehicles;
};
