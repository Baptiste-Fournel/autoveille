import { escapeRegExp, standaloneWordPattern } from '../parsing/regex.js';
import type { Family } from './families.js';

export interface BrandDef {
  readonly name: string;
  readonly family: Family;
  readonly aliases: readonly string[];
}

export interface BrandMatch {
  readonly make: string;
  readonly family: Family;
  readonly modelStart: number;
}

export interface CustomBrand {
  readonly name: string;
  readonly family: Family;
}

export const BRANDS: readonly BrandDef[] = [
  { name: 'Porsche', family: 'allemandes', aliases: [] },
  { name: 'Mercedes-Benz', family: 'allemandes', aliases: ['Mercedes', 'Mercedes Benz', 'Mercedes-AMG', 'Mercedes AMG'] },
  { name: 'BMW', family: 'allemandes', aliases: [] },
  { name: 'Audi', family: 'allemandes', aliases: [] },
  { name: 'Volkswagen', family: 'allemandes', aliases: ['VW'] },
  { name: 'Alpina', family: 'allemandes', aliases: [] },
  { name: 'Ruf', family: 'allemandes', aliases: [] },
  { name: 'Wiesmann', family: 'allemandes', aliases: [] },
  { name: 'Opel', family: 'allemandes', aliases: [] },
  { name: 'Smart', family: 'allemandes', aliases: [] },
  { name: 'Ferrari', family: 'italiennes', aliases: [] },
  { name: 'Lamborghini', family: 'italiennes', aliases: [] },
  { name: 'Maserati', family: 'italiennes', aliases: [] },
  { name: 'Pagani', family: 'italiennes', aliases: [] },
  { name: 'Alfa Romeo', family: 'italiennes', aliases: ['Alfa Roméo', 'Alfa-Romeo', 'Alfa'] },
  { name: 'Lancia', family: 'italiennes', aliases: [] },
  { name: 'Abarth', family: 'italiennes', aliases: [] },
  { name: 'De Tomaso', family: 'italiennes', aliases: ['DeTomaso'] },
  { name: 'Fiat', family: 'italiennes', aliases: [] },
  { name: 'Chevrolet', family: 'americaines', aliases: ['Chevy', 'Corvette'] },
  { name: 'Dodge', family: 'americaines', aliases: [] },
  { name: 'Cadillac', family: 'americaines', aliases: [] },
  { name: 'Chrysler', family: 'americaines', aliases: [] },
  { name: 'Jeep', family: 'americaines', aliases: [] },
  { name: 'GMC', family: 'americaines', aliases: [] },
  { name: 'Pontiac', family: 'americaines', aliases: [] },
  { name: 'Buick', family: 'americaines', aliases: [] },
  { name: 'Lincoln', family: 'americaines', aliases: [] },
  { name: 'Plymouth', family: 'americaines', aliases: [] },
  { name: 'Oldsmobile', family: 'americaines', aliases: [] },
  { name: 'Hummer', family: 'americaines', aliases: [] },
  { name: 'RAM', family: 'americaines', aliases: ['Dodge RAM'] },
  { name: 'Shelby', family: 'americaines', aliases: [] },
  { name: 'Tesla', family: 'americaines', aliases: [] },
  { name: 'Ford', family: 'americaines', aliases: [] },
  { name: 'Alpine', family: 'francaises', aliases: ['Renault Alpine'] },
  { name: 'Bugatti', family: 'francaises', aliases: [] },
  { name: 'Renault', family: 'francaises', aliases: ['Renault Sport'] },
  { name: 'Peugeot', family: 'francaises', aliases: [] },
  { name: 'Citroën', family: 'francaises', aliases: ['Citroen'] },
  { name: 'DS', family: 'francaises', aliases: ['DS Automobiles'] },
  { name: 'Venturi', family: 'francaises', aliases: [] },
  { name: 'Matra', family: 'francaises', aliases: ['Matra Simca', 'Talbot Matra'] },
  { name: 'Simca', family: 'francaises', aliases: [] },
  { name: 'Talbot', family: 'francaises', aliases: [] },
  { name: 'Facel Vega', family: 'francaises', aliases: ['Facel'] },
  { name: 'Panhard', family: 'francaises', aliases: [] },
  { name: 'Toyota', family: 'autres', aliases: [] },
  { name: 'Lexus', family: 'autres', aliases: [] },
  { name: 'Honda', family: 'autres', aliases: [] },
  { name: 'Acura', family: 'autres', aliases: [] },
  { name: 'Nissan', family: 'autres', aliases: ['Datsun'] },
  { name: 'Infiniti', family: 'autres', aliases: [] },
  { name: 'Mazda', family: 'autres', aliases: [] },
  { name: 'Subaru', family: 'autres', aliases: [] },
  { name: 'Mitsubishi', family: 'autres', aliases: [] },
  { name: 'Suzuki', family: 'autres', aliases: [] },
  { name: 'Daihatsu', family: 'autres', aliases: [] },
  { name: 'Isuzu', family: 'autres', aliases: [] },
  { name: 'Hyundai', family: 'autres', aliases: [] },
  { name: 'Kia', family: 'autres', aliases: [] },
  { name: 'Genesis', family: 'autres', aliases: [] },
  { name: 'SsangYong', family: 'autres', aliases: ['Ssangyong', 'KGM'] },
  { name: 'Volvo', family: 'autres', aliases: [] },
  { name: 'Saab', family: 'autres', aliases: [] },
  { name: 'Polestar', family: 'autres', aliases: [] },
  { name: 'Koenigsegg', family: 'autres', aliases: [] },
  { name: 'Skoda', family: 'autres', aliases: ['Škoda'] },
  { name: 'Seat', family: 'autres', aliases: [] },
  { name: 'Cupra', family: 'autres', aliases: [] },
  { name: 'Dacia', family: 'autres', aliases: [] },
  { name: 'Jaguar', family: 'autres', aliases: [] },
  { name: 'Land Rover', family: 'autres', aliases: ['Range Rover', 'Landrover'] },
  { name: 'Mini', family: 'autres', aliases: [] },
  { name: 'Aston Martin', family: 'autres', aliases: ['Aston-Martin'] },
  { name: 'Bentley', family: 'autres', aliases: [] },
  { name: 'Rolls-Royce', family: 'autres', aliases: ['Rolls Royce'] },
  { name: 'Lotus', family: 'autres', aliases: [] },
  { name: 'McLaren', family: 'autres', aliases: ['Mclaren'] },
  { name: 'MG', family: 'autres', aliases: [] },
  { name: 'Morgan', family: 'autres', aliases: [] },
  { name: 'TVR', family: 'autres', aliases: [] },
  { name: 'Caterham', family: 'autres', aliases: [] },
  { name: 'Triumph', family: 'autres', aliases: [] },
  { name: 'Austin', family: 'autres', aliases: ['Austin-Healey', 'Austin Healey'] },
  { name: 'Rover', family: 'autres', aliases: [] },
  { name: 'Lada', family: 'autres', aliases: [] },
  { name: 'BYD', family: 'autres', aliases: [] },
  { name: 'Lynk & Co', family: 'autres', aliases: ['Lynk&Co', 'Lynk and Co'] },
  { name: 'Xpeng', family: 'autres', aliases: [] },
  { name: 'Nio', family: 'autres', aliases: [] },
  { name: 'Leapmotor', family: 'autres', aliases: [] },
];

export const FORD_US_MODELS: readonly string[] = [
  'Mustang',
  'GT',
  'Bronco',
  'F-150',
  'F150',
  'F-250',
  'Raptor',
  'Thunderbird',
  'Explorer',
  'Expedition',
  'Excursion',
  'Ranger',
  'Maverick',
  'Crown Victoria',
  'Torino',
  'Galaxie',
  'Fairlane',
  'Falcon',
  'Edge',
  'Flex',
  'Taurus',
  'Lightning',
  'Shelby',
  'Cobra',
];

interface AliasPattern {
  readonly pattern: RegExp;
  readonly def: BrandDef;
}

interface BrandPosition {
  readonly def: BrandDef;
  readonly start: number;
  readonly end: number;
}

const wordPattern = (word: string): RegExp => new RegExp(`(^|[^\\p{L}])${escapeRegExp(word)}(?=$|[^\\p{L}])`, 'iu');

const CATALOG_PATTERNS: readonly AliasPattern[] = BRANDS.flatMap((def) =>
  [def.name, ...def.aliases].sort((a, b) => b.length - a.length).map((alias) => ({ pattern: wordPattern(alias), def })),
).sort((a, b) => b.pattern.source.length - a.pattern.source.length);

const sameName = (a: string, b: string): boolean => a.toLowerCase() === b.toLowerCase();

const isFollowedCatalogBrand = (name: string): boolean => BRANDS.some((known) => known.family !== 'autres' && sameName(known.name, name));

const brandDefOf = (brand: CustomBrand): BrandDef => ({ name: brand.name.trim(), family: brand.family, aliases: [] });

const customBrandPatterns = (customBrands: readonly CustomBrand[]): readonly AliasPattern[] =>
  customBrands
    .filter((brand) => !isFollowedCatalogBrand(brand.name))
    .map(brandDefOf)
    .filter((def) => def.name !== '')
    .map((def) => ({ pattern: wordPattern(def.name), def }));

const positionOf = ({ pattern, def }: AliasPattern, title: string): BrandPosition | undefined => {
  const match = pattern.exec(title);
  if (!match || match[1] === undefined) {
    return undefined;
  }
  const start = match.index + match[1].length;
  return { def, start, end: start + match[0].length - match[1].length };
};

const isBetterPosition = (candidate: BrandPosition, best: BrandPosition | undefined): boolean =>
  best === undefined || candidate.start < best.start || (candidate.start === best.start && candidate.end > best.end);

export function detectBrand(title: string, customBrands: readonly CustomBrand[]): BrandMatch | undefined {
  const best = [...customBrandPatterns(customBrands), ...CATALOG_PATTERNS].reduce<BrandPosition | undefined>((found, alias) => {
    const position = positionOf(alias, title);
    return position && isBetterPosition(position, found) ? position : found;
  }, undefined);
  return best ? { make: best.def.name, family: best.def.family, modelStart: best.end } : undefined;
}

const isAmericanFord = (model: string | undefined, title: string): boolean => {
  const haystack = `${model ?? ''} ${title}`;
  return FORD_US_MODELS.some((usModel) => standaloneWordPattern(usModel).test(haystack));
};

export function detectFamily(
  make: string | undefined,
  model: string | undefined,
  title: string,
  customBrands: readonly CustomBrand[],
): Family {
  if (!make) {
    return 'autres';
  }
  const def = customBrands.map(brandDefOf).find((custom) => sameName(custom.name, make)) ?? BRANDS.find((brand) => brand.name === make);
  if (!def) {
    return 'autres';
  }
  if (def.name === 'Ford') {
    return isAmericanFord(model, title) ? 'americaines' : 'autres';
  }
  return def.family;
}

export function brandsOfFamily(family: Family): readonly string[] {
  return BRANDS.filter((brand) => brand.family === family).map((brand) => brand.name);
}
