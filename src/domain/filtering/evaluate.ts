import { standaloneWordPattern } from '../parsing/regex.js';
import type { FamilyRules, Settings } from '../settings/types.js';
import type { RawListing, VehicleInfo } from '../vehicle/types.js';
import type { RejectionReason, SpecialReason, Verdict } from './verdict.js';

const firstMatchingKeyword = (keywords: readonly string[], text: string): string | undefined =>
  keywords.map((keyword) => keyword.trim()).find((keyword) => keyword !== '' && standaloneWordPattern(keyword).test(text));

export function specialReason(rules: FamilyRules, info: VehicleInfo, raw: Pick<RawListing, 'title'>): SpecialReason | undefined {
  if (info.price !== undefined && rules.minPrice > 0 && info.price >= rules.minPrice) {
    return { kind: 'priceFloor', minPrice: rules.minPrice };
  }
  if (info.year !== undefined && rules.maxYear > 0 && info.year <= rules.maxYear) {
    return { kind: 'yearCap', maxYear: rules.maxYear };
  }
  const keyword = firstMatchingKeyword(rules.keywords, `${raw.title} ${info.model ?? ''}`);
  return keyword === undefined ? undefined : { kind: 'keyword', keyword };
}

const brandRejections = (info: VehicleInfo, raw: Pick<RawListing, 'title'>, settings: Settings): readonly RejectionReason[] => {
  const rules = settings.families[info.family];
  if (info.family === 'autres' || !rules.enabled) {
    return [info.make ? { kind: 'unfollowedBrand', make: info.make } : { kind: 'unknownBrand' }];
  }
  const disabled: readonly RejectionReason[] =
    info.make && !rules.brands.includes(info.make) ? [{ kind: 'disabledBrand', make: info.make }] : [];
  const notSpecial: readonly RejectionReason[] =
    settings.specialOnly && specialReason(rules, info, raw) === undefined ? [{ kind: 'notSpecial' }] : [];
  return [...disabled, ...notSpecial];
};

const sellerRejections = (raw: Pick<RawListing, 'sellerType'>, settings: Settings): readonly RejectionReason[] =>
  settings.privateOnly && raw.sellerType === 'pro' ? [{ kind: 'professionalSeller' }] : [];

const mileageRejections = (km: number | undefined, maxKm: number): readonly RejectionReason[] =>
  km !== undefined && maxKm > 0 && km > maxKm ? [{ kind: 'mileageAbove', km, maxKm }] : [];

const distanceRejections = (distanceKm: number | null, radiusKm: number): readonly RejectionReason[] =>
  distanceKm !== null && radiusKm > 0 && distanceKm > radiusKm ? [{ kind: 'outsideRadius', distanceKm, radiusKm }] : [];

export function evaluate(
  raw: Pick<RawListing, 'title' | 'sellerType'>,
  info: VehicleInfo,
  settings: Settings,
  distanceKm: number | null,
): Verdict {
  const rejections = [
    ...brandRejections(info, raw, settings),
    ...sellerRejections(raw, settings),
    ...mileageRejections(info.km, settings.maxKm),
    ...distanceRejections(distanceKm, settings.zone.radiusKm),
  ];
  return { pass: rejections.length === 0, rejections };
}
