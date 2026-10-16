import type { RepairSummary } from '../../../application/ingest/repairVehicles.js';
import type { RepairResponse } from '../../../shared/api.js';

export const repairDto = (summary: RepairSummary): RepairResponse => ({
  vehicles: summary.vehicles,
  renamed: summary.renamed,
  split: summary.split,
  reevaluated: summary.reevaluated,
});
