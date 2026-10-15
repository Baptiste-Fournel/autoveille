import { type Family, FOLLOWED_FAMILIES } from '../catalog/families.js';
import { withoutDiacritics } from '../parsing/text.js';
import type { FamilyRules, Settings } from '../settings/types.js';
import { SITES, type SiteKey } from './catalog.js';

export interface AlertBounds {
  readonly radiusKm: number;
  readonly maxKm: number;
}

export interface SiteSetup {
  readonly key: SiteKey;
  readonly label: string;
  readonly searchUrl: string;
  readonly prefilled: boolean;
  readonly manageUrl?: string;
  readonly alertRadiusKm: number;
  readonly alertMaxKm: number;
}

export interface BrandsSearch {
  readonly kind: 'brands';
  readonly url: string;
  readonly brands: readonly string[];
  readonly brandNames: readonly string[];
  readonly minPrice?: number;
}

export interface CollectionSearch {
  readonly kind: 'collection';
  readonly url: string;
  readonly maxYear: number;
}

export type TargetedSearch = BrandsSearch | CollectionSearch;

interface Widening {
  readonly min: number;
  readonly max: number;
  readonly step: number;
}

const ALERT_WIDENING_FACTOR = 1.5;
const ALERT_RADIUS_KM: Widening = { min: 150, max: 400, step: 50 };
const ALERT_MAX_KM: Widening = { min: 150_000, max: 300_000, step: 10_000 };
const RADIUS_KM_WHEN_UNLIMITED = 100;
const MAX_KM_WHEN_UNLIMITED = 100_000;

const SEARCH_ZONE_WHEN_UNSET = { city: 'Bordeaux', postalCode: '33000', lat: 44.8378, lon: -0.5792 } as const;
const PARUVENDU_BORDEAUX_INSEE = '33063';

const TARGETED_PRICE_FLOOR_RATIO = 0.75;
const TARGETED_PRICE_FLOOR_STEP = 5_000;
const LACENTRALE_MAX_BRANDS_PER_SEARCH = 3;
const LACENTRALE_HIGH_VOLUME_CODES: readonly string[] = ['PORSCHE', 'MERCEDES', 'BMW', 'AUDI'];
const LACENTRALE_FORD_US_CODE = 'FORD:MUSTANG';
const LACENTRALE_FORD_US_NAME = 'Ford Mustang';
const LACENTRALE_OTHER_FORD_US: readonly (readonly [string, string])[] = [
  ['FORD:GT', 'Ford GT'],
  ['FORD:BRONCO', 'Ford Bronco'],
  ['FORD:F-150', 'Ford F-150'],
];

const widen = (value: number, widening: Widening): number =>
  Math.min(widening.max, Math.max(widening.min, Math.ceil((value * ALERT_WIDENING_FACTOR) / widening.step) * widening.step));

export function alertBounds(settings: Settings): AlertBounds {
  return {
    radiusKm: widen(settings.zone.radiusKm || RADIUS_KM_WHEN_UNLIMITED, ALERT_RADIUS_KM),
    maxKm: widen(settings.maxKm || MAX_KM_WHEN_UNLIMITED, ALERT_MAX_KM),
  };
}

interface SearchLink {
  readonly url: string;
  readonly prefilled: boolean;
}

const blankSearch = (url: string): SearchLink => ({ url, prefilled: false });

function searchLinks(settings: Settings, bounds: AlertBounds): Readonly<Record<SiteKey, SearchLink>> {
  const { zone } = settings;
  const radius = bounds.radiusKm;
  const km = bounds.maxKm;
  const city = zone.city || SEARCH_ZONE_WHEN_UNSET.city;
  const postal = zone.postalCode || SEARCH_ZONE_WHEN_UNSET.postalCode;
  const lat = zone.lat ?? SEARCH_ZONE_WHEN_UNSET.lat;
  const lon = zone.lon ?? SEARCH_ZONE_WHEN_UNSET.lon;
  return {
    leboncoin: {
      url: `https://www.leboncoin.fr/recherche?category=2&locations=${encodeURIComponent(city)}__${lat.toFixed(4)}_${lon.toFixed(4)}_5000_${radius * 1000}&owner_type=private&mileage=min-${km}`,
      prefilled: true,
    },
    lacentrale: { url: `https://www.lacentrale.fr/listing?customerFamilyCodes=PART&dptCp=${postal}&mileageMax=${km}`, prefilled: true },
    autoscout24: { url: `https://www.autoscout24.fr/lst?custtype=P&kmto=${km}&zip=${postal}&zipr=${radius}&cy=F&atype=C`, prefilled: true },
    paruvendu: /^bordeaux$/i.test(city.trim())
      ? {
          url: `https://www.paruvendu.fr/auto-moto/listefo/default/default?reaf=1&codeINSEE=${PARUVENDU_BORDEAUX_INSEE}%2C&ray=${radius}&r=VVO00000&km1=${km}&codPro=off`,
          prefilled: true,
        }
      : blankSearch('https://www.paruvendu.fr/voiture-occasion/'),
    largus: blankSearch('https://occasion.largus.fr/voiture-occasion/'),
    'ouestfrance-auto': blankSearch('https://www.ouestfrance-auto.com/voiture-occasion/'),
    'annonces-automobile': blankSearch('https://www.annonces-automobile.com/'),
    leparking: blankSearch('https://www.leparking.fr/voiture-occasion/'),
  };
}

export function siteSetups(settings: Settings): readonly SiteSetup[] {
  const bounds = alertBounds(settings);
  const links = searchLinks(settings, bounds);
  return SITES.map((site) => ({
    key: site.key,
    label: site.label,
    searchUrl: links[site.key].url,
    prefilled: links[site.key].prefilled,
    manageUrl: site.manageAlertUrl,
    alertRadiusKm: bounds.radiusKm,
    alertMaxKm: bounds.maxKm,
  }));
}

function laCentraleBrandCode(brand: string): string {
  const code = withoutDiacritics(brand).toUpperCase().trim();
  return code === 'MERCEDES-BENZ' ? 'MERCEDES' : code;
}

const targetedPriceFloor = (minPrice: number): number =>
  minPrice > 0
    ? Math.max(
        TARGETED_PRICE_FLOOR_STEP,
        Math.floor((minPrice * TARGETED_PRICE_FLOOR_RATIO) / TARGETED_PRICE_FLOOR_STEP) * TARGETED_PRICE_FLOOR_STEP,
      )
    : 0;

const inGroupsOf = (size: number, codes: readonly string[]): readonly (readonly string[])[] =>
  Array.from({ length: Math.ceil(codes.length / size) }, (_, index) => codes.slice(index * size, index * size + size));

function brandCodeGroups(family: Family, codes: readonly string[]): readonly (readonly string[])[] {
  const alone = family === 'allemandes' ? codes.filter((code) => LACENTRALE_HIGH_VOLUME_CODES.includes(code)) : [];
  const shared = codes.filter((code) => !alone.includes(code));
  const otherFordUs = codes.includes(LACENTRALE_FORD_US_CODE) ? [LACENTRALE_OTHER_FORD_US.map(([code]) => code)] : [];
  return [...alone.map((code) => [code]), ...inGroupsOf(LACENTRALE_MAX_BRANDS_PER_SEARCH, shared), ...otherFordUs];
}

function familySearches(family: Family, rules: FamilyRules, searchUrl: (criteria: string) => string): readonly BrandsSearch[] {
  const floor = targetedPriceFloor(rules.minPrice);
  const coded = rules.brands.map((brand) => {
    const code = family === 'americaines' && /^ford$/i.test(brand) ? LACENTRALE_FORD_US_CODE : laCentraleBrandCode(brand);
    return [code, code === LACENTRALE_FORD_US_CODE ? LACENTRALE_FORD_US_NAME : brand.trim()] as const;
  });
  const codes = coded.map(([code]) => code);
  const names = new Map<string, string>([...coded, ...(codes.includes(LACENTRALE_FORD_US_CODE) ? LACENTRALE_OTHER_FORD_US : [])]);
  return brandCodeGroups(family, codes).map((group) => ({
    kind: 'brands',
    url: searchUrl(`makesModelsCommercialNames=${encodeURIComponent(group.join(';'))}${floor ? `&priceMin=${floor}` : ''}`),
    brands: group,
    brandNames: group.map((code) => names.get(code) ?? code),
    minPrice: floor || undefined,
  }));
}

export function targetedSearches(settings: Settings, site: string): readonly TargetedSearch[] {
  if (site !== 'lacentrale') {
    return [];
  }
  const postal = settings.zone.postalCode || SEARCH_ZONE_WHEN_UNSET.postalCode;
  const km = alertBounds(settings).maxKm;
  const searchUrl = (criteria: string): string =>
    `https://www.lacentrale.fr/listing?${criteria}&customerFamilyCodes=PART&distance=5&dptCp=${postal}&mileageMax=${km}&sortBy=firstOnlineDateDesc`;
  const families = FOLLOWED_FAMILIES.flatMap((family) => {
    const rules = settings.families[family];
    return rules.enabled && rules.brands.length > 0 ? [{ family, rules }] : [];
  });
  const oldest = families.reduce((year, { rules }) => (rules.maxYear > year ? rules.maxYear : year), 0);
  const collection: readonly CollectionSearch[] =
    oldest > 0 ? [{ kind: 'collection', url: searchUrl(`yearMax=${oldest}`), maxYear: oldest }] : [];
  return [...families.flatMap(({ family, rules }) => familySearches(family, rules, searchUrl)), ...collection];
}
