import { type CustomBrand, detectBrand, detectFamily } from '../catalog/brands.js';
import type { RawListing, VehicleInfo } from '../vehicle/types.js';
import { parseKm } from './km.js';
import { extractModel, modelFromSellerWords } from './model.js';
import { parsePrice } from './price.js';
import { cleanText } from './text.js';
import { maxPlausibleYear, parseYear } from './year.js';

export interface ExtractionContext {
  readonly customBrands: readonly CustomBrand[];
  readonly currentYear: number;
}

export function extractVehicleInfo(raw: RawListing, context: ExtractionContext): VehicleInfo {
  const title = cleanText(raw.title);
  const blob = `${title} ${raw.description ?? ''}`;
  const inTitle = detectBrand(title, context.customBrands);
  const brand = inTitle ?? detectBrand(blob, context.customBrands);
  const model = inTitle
    ? (extractModel(title, inTitle.modelStart) ?? modelFromSellerWords(title, inTitle, context.customBrands))
    : undefined;
  return {
    make: brand?.make,
    model,
    family: detectFamily(brand?.make, model, blob, context.customBrands),
    year: raw.year ?? parseYear(blob, maxPlausibleYear(context.currentYear)),
    km: raw.km ?? parseKm(blob),
    price: raw.price ?? parsePrice(blob),
  };
}
