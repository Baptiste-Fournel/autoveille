import type { RawListing } from '../../domain/vehicle/types.js';
import { type IngestDependencies, type IngestOutcome, ingestListing } from '../ingest/ingestListing.js';

export interface IngestedInTurn {
  readonly newMatchedVehicles: number;
  readonly leftAside: number;
}

const isNewMatchedVehicle = (outcome: IngestOutcome): boolean => outcome.kind === 'created' && outcome.verdict.pass;

export const ingestInTurn = async (
  dependencies: IngestDependencies,
  listings: readonly RawListing[],
  aboutOlderAds: boolean,
): Promise<IngestedInTurn> => {
  let newMatchedVehicles = 0;
  let leftAside = 0;
  for (const listing of listings) {
    const outcome = await ingestListing(dependencies, { listing, settings: dependencies.settings.load(), notify: true, aboutOlderAds });
    newMatchedVehicles += isNewMatchedVehicle(outcome) ? 1 : 0;
    leftAside += outcome.kind === 'leftAside' ? 1 : 0;
  }
  return { newMatchedVehicles, leftAside };
};
