import { createHash } from 'node:crypto';
import { fold } from '../parsing/text.js';
import type { RawListing, VehicleInfo } from './types.js';

export interface KmAndPrice {
  readonly km?: number | null;
  readonly price?: number | null;
}

const SAME_CAR_KM_TOLERANCE = 5000;
const SAME_CAR_KM_RATIO = 0.1;
const SAME_CAR_PRICE_RATIO = 0.15;
const PRICE_ONLY_RATIO = 0.1;
const FINGERPRINT_LENGTH = 16;
const TITLE_WORDS_WITHOUT_MODEL = 3;

export function fingerprint(info: VehicleInfo, raw: Pick<RawListing, 'title' | 'postalCode'>): string {
  const parts = [
    fold(info.make ?? 'inconnu'),
    fold(info.model ?? fold(raw.title).split(' ').slice(0, TITLE_WORDS_WITHOUT_MODEL).join(' ')),
    String(info.year ?? 'x'),
    raw.postalCode?.slice(0, 2) ?? 'xx',
  ];
  return createHash('sha1').update(parts.join('|')).digest('hex').slice(0, FINGERPRINT_LENGTH);
}

const isWithinRatio = (a: number, b: number, ratio: number): boolean => Math.abs(a - b) <= ratio * Math.max(a, b);

export function similar(a: KmAndPrice, b: KmAndPrice): boolean {
  const aKm = a.km ?? undefined;
  const bKm = b.km ?? undefined;
  const aPrice = a.price ?? undefined;
  const bPrice = b.price ?? undefined;
  const pricesAgree = (ratio: number): boolean => aPrice === undefined || bPrice === undefined || isWithinRatio(aPrice, bPrice, ratio);
  if (aKm !== undefined && bKm !== undefined) {
    return (
      Math.abs(aKm - bKm) <= Math.max(SAME_CAR_KM_TOLERANCE, SAME_CAR_KM_RATIO * Math.max(aKm, bKm)) && pricesAgree(SAME_CAR_PRICE_RATIO)
    );
  }
  if (aPrice !== undefined && bPrice !== undefined) {
    return pricesAgree(PRICE_ONLY_RATIO);
  }
  return true;
}
