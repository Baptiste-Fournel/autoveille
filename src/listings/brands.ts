import {
  type BrandMatch,
  type CustomBrand,
  detectBrand as detectBrandAmong,
  detectFamily as detectFamilyAmong,
} from '../domain/catalog/brands.js';
import type { Family } from '../domain/catalog/families.js';

export type { BrandMatch, CustomBrand } from '../domain/catalog/brands.js';
export { BRANDS, brandsOfFamily, FORD_US_MODELS } from '../domain/catalog/brands.js';

export function detectBrand(title: string, extra: readonly CustomBrand[] = []): BrandMatch | undefined {
  return detectBrandAmong(title, extra);
}

export function detectFamily(
  make: string | undefined,
  model: string | undefined,
  title: string,
  extra: readonly CustomBrand[] = [],
): Family {
  return detectFamilyAmong(make, model, title, extra);
}
