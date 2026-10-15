import type { RejectionReason } from './domain/filtering/verdict.js';
import { describeRejection } from './domain/presentation/reasons.js';

const BRAND = /^marque /i;
const UNKNOWN_BRAND = /^marque non reconnue$/i;
const DISABLED_BRAND = /^marque (.+) désactivée$/i;
const UNFOLLOWED_BRAND = /^marque (.+) hors des familles suivies$/i;
const NOT_SPECIAL = /^ni supercar/i;
const PROFESSIONAL_SELLER = /^vendeur professionnel/i;
const OUTSIDE_RADIUS = /hors du rayon/i;
const MILEAGE_ABOVE = /au-dessus de .* km/i;

const numbersIn = (phrase: string): readonly number[] =>
  (phrase.match(/\d[\d \u00a0\u202f]*/g) ?? []).map((digits) => Number(digits.replace(/\D/g, '')));

const brandRejection = (phrase: string): RejectionReason => {
  if (UNKNOWN_BRAND.test(phrase)) {
    return { kind: 'unknownBrand' };
  }
  const disabled = DISABLED_BRAND.exec(phrase);
  if (disabled?.[1] !== undefined) {
    return { kind: 'disabledBrand', make: disabled[1] };
  }
  const unfollowed = UNFOLLOWED_BRAND.exec(phrase);
  return { kind: 'unfollowedBrand', make: unfollowed?.[1] ?? phrase.replace(BRAND, '') };
};

const distanceOf = (writtenKm: number, vehicleDistanceKm: number | null): number =>
  vehicleDistanceKm !== null && Math.round(vehicleDistanceKm) === writtenKm ? vehicleDistanceKm : writtenKm;

const rejectionOf = (phrase: string, vehicleDistanceKm: number | null): readonly RejectionReason[] => {
  if (BRAND.test(phrase)) {
    return [brandRejection(phrase)];
  }
  if (NOT_SPECIAL.test(phrase)) {
    return [{ kind: 'notSpecial' }];
  }
  if (PROFESSIONAL_SELLER.test(phrase)) {
    return [{ kind: 'professionalSeller' }];
  }
  if (OUTSIDE_RADIUS.test(phrase)) {
    const [writtenKm = 0, radiusKm = 0] = numbersIn(phrase);
    return [{ kind: 'outsideRadius', distanceKm: distanceOf(writtenKm, vehicleDistanceKm), radiusKm }];
  }
  if (MILEAGE_ABOVE.test(phrase)) {
    const [km = 0, maxKm = 0] = numbersIn(phrase);
    return [{ kind: 'mileageAbove', km, maxKm }];
  }
  return [];
};

const phrasesIn = (stored: string): readonly string[] => {
  const parsed: unknown = JSON.parse(stored || '[]');
  return Array.isArray(parsed) ? parsed.filter((phrase): phrase is string => typeof phrase === 'string') : [];
};

export const storedRejections = (stored: string, vehicleDistanceKm: number | null): readonly RejectionReason[] =>
  phrasesIn(stored).flatMap((phrase) => rejectionOf(phrase, vehicleDistanceKm));

export const rejectionsToStore = (rejections: readonly RejectionReason[]): string => JSON.stringify(rejections.map(describeRejection));
