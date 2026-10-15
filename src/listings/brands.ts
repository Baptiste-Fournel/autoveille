import type { Family } from '../types.js';

/** Canonical brand name -> family, plus aliases as they appear in ad titles. */
interface BrandDef {
  name: string;
  family: Family;
  aliases: string[];
}

export const BRANDS: BrandDef[] = [
  // Allemandes
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
  // Italiennes
  { name: 'Ferrari', family: 'italiennes', aliases: [] },
  { name: 'Lamborghini', family: 'italiennes', aliases: [] },
  { name: 'Maserati', family: 'italiennes', aliases: [] },
  { name: 'Pagani', family: 'italiennes', aliases: [] },
  { name: 'Alfa Romeo', family: 'italiennes', aliases: ['Alfa Roméo', 'Alfa-Romeo', 'Alfa'] },
  { name: 'Lancia', family: 'italiennes', aliases: [] },
  { name: 'Abarth', family: 'italiennes', aliases: [] },
  { name: 'De Tomaso', family: 'italiennes', aliases: ['DeTomaso'] },
  { name: 'Fiat', family: 'italiennes', aliases: [] },
  // Américaines (Ford is special-cased: only its US models count, see detectFamily)
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
  // Françaises
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
  // Autres marques, reconnues pour nommer la voiture et expliquer pourquoi elle est écartée
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

/** Ford models that are "American" Fords; a Ford Fiesta is not what a US-car specialist wants. */
export const FORD_US_MODELS = ['Mustang', 'GT', 'Bronco', 'F-150', 'F150', 'F-250', 'Raptor', 'Thunderbird', 'Explorer', 'Expedition', 'Excursion', 'Ranger', 'Maverick', 'Crown Victoria', 'Torino', 'Galaxie', 'Fairlane', 'Falcon', 'Edge', 'Flex', 'Taurus', 'Lightning', 'Shelby', 'Cobra'];

const ALIAS_INDEX: Array<{ pattern: RegExp; def: BrandDef }> = BRANDS.flatMap((def) =>
  [def.name, ...def.aliases]
    .sort((a, b) => b.length - a.length)
    .map((alias) => ({ pattern: new RegExp(`(^|[^\\p{L}])${escapeRegExp(alias)}(?=$|[^\\p{L}])`, 'iu'), def })),
).sort((a, b) => b.pattern.source.length - a.pattern.source.length);

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export interface BrandMatch {
  make: string;
  family: Family;
  /** Index in the title right after the brand token, where the model name starts. */
  modelStart: number;
}

export interface CustomBrand { name: string; family: Family }

const customCache = new Map<string, Array<{ pattern: RegExp; def: BrandDef }>>();
function customIndex(extra: CustomBrand[]): Array<{ pattern: RegExp; def: BrandDef }> {
  if (!extra.length) return [];
  const key = JSON.stringify(extra);
  let idx = customCache.get(key);
  if (!idx) {
    idx = extra
      .filter((b) => b.name.trim() && !BRANDS.some((k) => k.family !== 'autres' && k.name.toLowerCase() === b.name.toLowerCase()))
      .map((b) => ({ pattern: new RegExp(`(^|[^\\p{L}])${escapeRegExp(b.name.trim())}(?=$|[^\\p{L}])`, 'iu'), def: { name: b.name.trim(), family: b.family, aliases: [] } }));
    customCache.set(key, idx);
  }
  return idx;
}

/** Find the brand in a title. Longest alias wins ("Alfa Romeo" before "Alfa", "Dodge RAM" before "Dodge"). */
export function detectBrand(title: string, extra: CustomBrand[] = []): BrandMatch | undefined {
  let best: { def: BrandDef; index: number; end: number } | undefined;
  for (const { pattern, def } of [...customIndex(extra), ...ALIAS_INDEX]) {
    const m = pattern.exec(title);
    if (!m || m[1] === undefined) continue;
    const start = m.index + m[1].length;
    const end = start + m[0].length - m[1].length;
    if (!best || start < best.index || (start === best.index && end > best.end)) {
      best = { def, index: start, end };
    }
  }
  if (!best) return undefined;
  return { make: best.def.name, family: best.def.family, modelStart: best.end };
}

/** Family of a (make, model) pair, with the Ford special case. */
export function detectFamily(make: string | undefined, model: string | undefined, title: string, extra: CustomBrand[] = []): Family {
  if (!make) return 'autres';
  // A brand the person added to a family wins over the built-in "other brand" entry (Toyota moved to a family, say).
  const custom = extra.find((b) => b.name.trim().toLowerCase() === make.toLowerCase());
  const def = custom ? { name: custom.name.trim(), family: custom.family, aliases: [] as string[] } : BRANDS.find((b) => b.name === make);
  if (!def) return 'autres';
  if (def.name === 'Ford') {
    const hay = `${model ?? ''} ${title}`;
    const isUs = FORD_US_MODELS.some((m) => new RegExp(`(^|[^\\p{L}\\d])${escapeRegExp(m)}(?=$|[^\\p{L}\\d])`, 'iu').test(hay));
    return isUs ? 'americaines' : 'autres';
  }
  return def.family;
}

export function brandsOfFamily(family: Family): string[] {
  return BRANDS.filter((b) => b.family === family).map((b) => b.name);
}
