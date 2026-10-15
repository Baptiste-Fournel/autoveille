import type { CustomBrand } from '../domain/catalog/brands.js';
import { extractVehicleInfo as extractWithContext } from '../domain/parsing/vehicleInfo.js';
import { maxPlausibleYear, parseYear as parseYearUpTo } from '../domain/parsing/year.js';
import type { RawListing, VehicleInfo } from '../domain/vehicle/types.js';

export { parseKm } from '../domain/parsing/km.js';
export { parseLocation } from '../domain/parsing/location.js';
export { extractModel } from '../domain/parsing/model.js';
export { parsePrice } from '../domain/parsing/price.js';
export { cleanText, titleCase } from '../domain/parsing/text.js';
export { formatInteger as fmtInt } from '../domain/presentation/numbers.js';
export { fingerprint, similar } from '../domain/vehicle/identity.js';

const currentYear = (): number => new Date().getFullYear();

export function parseYear(text: string): number | undefined {
  return parseYearUpTo(text, maxPlausibleYear(currentYear()));
}

export function extractVehicleInfo(raw: RawListing, extra: readonly CustomBrand[] = []): VehicleInfo {
  return extractWithContext(raw, { customBrands: extra, currentYear: currentYear() });
}
