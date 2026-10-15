import type { CustomBrand } from '../catalog/brands.js';
import { ALL_FAMILIES } from '../catalog/families.js';
import type { Settings } from './types.js';

export const customBrandsOf = (settings: Settings): readonly CustomBrand[] =>
  ALL_FAMILIES.flatMap((family) => settings.families[family].known.map((name) => ({ name, family })));
