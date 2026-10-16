import { decideIngest, type IngestDecision } from '../../src/domain/ingest/decide.js';
import type { Identification } from '../../src/domain/ingest/identify.js';
import { extractVehicleInfo } from '../../src/domain/parsing/vehicleInfo.js';
import { customBrandsOf } from '../../src/domain/settings/customBrands.js';
import { defaultSettings } from '../../src/domain/settings/defaults.js';
import type { RawListing } from '../../src/domain/vehicle/types.js';

export const NOW = '2026-10-15T08:30:00.000Z';

export const decide = (listing: RawListing, identification: Identification, now = NOW): IngestDecision => {
  const settings = defaultSettings();
  return decideIngest({
    listing,
    info: extractVehicleInfo(listing, { customBrands: customBrandsOf(settings), currentYear: 2026 }),
    settings,
    identification,
    now,
  });
};
