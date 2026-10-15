import { customBrandsOf } from '../settings/customBrands.js';
import type { Settings } from '../settings/types.js';
import { yearOf } from '../time/yearOf.js';
import type { ExtractionContext } from './vehicleInfo.js';

export const extractionContextAt = (settings: Settings, now: string): ExtractionContext => ({
  customBrands: customBrandsOf(settings),
  currentYear: yearOf(now),
});
