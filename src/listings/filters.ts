import type { Family, FilterResult, RawListing, Settings, VehicleInfo } from '../types.js';
import { fmtInt } from './normalize.js';

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function keywordMatches(keywords: string[], haystack: string): string | undefined {
  for (const kw of keywords) {
    const k = kw.trim();
    if (!k) continue;
    // Word boundaries that also work around digits and dots ("M3", "3.0 CSL", "R.S.")
    const re = new RegExp(`(^|[^\\p{L}\\d])${escapeRegExp(k)}(?=$|[^\\p{L}\\d])`, 'iu');
    if (re.test(haystack)) return k;
  }
  return undefined;
}

/** Is this vehicle "special" (supercar / collection) under the family's rule? Returns the reason it passed. */
export function specialReason(family: Family, info: VehicleInfo, raw: RawListing, settings: Settings): string | undefined {
  const rules = settings.families[family];
  if (!rules) return undefined;
  if (info.price !== undefined && rules.minPrice > 0 && info.price >= rules.minPrice) return `prix ≥ ${fmtInt(rules.minPrice)} €`;
  if (info.year !== undefined && rules.maxYear > 0 && info.year <= rules.maxYear) return `année ≤ ${rules.maxYear}`;
  const kw = keywordMatches(rules.keywords, `${raw.title} ${info.model ?? ''}`);
  if (kw) return `modèle « ${kw} »`;
  return undefined;
}

export type ReasonKind = 'marque' | 'special' | 'pro' | 'km' | 'loin' | 'autre';

/** The family of a refusal reason, for the « écartées » screen filters. */
export function reasonKind(reason: string): ReasonKind {
  if (/^marque /i.test(reason)) return 'marque';
  if (/^ni supercar/i.test(reason)) return 'special';
  if (/^vendeur professionnel/i.test(reason)) return 'pro';
  if (/hors du rayon/i.test(reason)) return 'loin';
  if (/au-dessus de .* km/i.test(reason)) return 'km';
  return 'autre';
}

export interface EvalContext {
  distanceKm?: number | null;
}

export function evaluate(raw: RawListing, info: VehicleInfo, settings: Settings, ctx: EvalContext = {}): FilterResult {
  const reasons: string[] = [];
  const family = info.family;

  if (family === 'autres' || !settings.families[family]?.enabled) {
    reasons.push(info.make ? `marque ${info.make} hors des familles suivies` : 'marque non reconnue');
  } else {
    const rules = settings.families[family];
    if (info.make && !rules.brands.includes(info.make)) reasons.push(`marque ${info.make} désactivée`);
    if (settings.specialOnly) {
      const why = specialReason(family, info, raw, settings);
      if (!why) reasons.push('ni supercar ni collection selon les réglages');
    }
  }

  if (settings.privateOnly && raw.sellerType === 'pro') reasons.push('vendeur professionnel');

  if (info.km !== undefined && settings.maxKm > 0 && info.km > settings.maxKm) {
    reasons.push(`${fmtInt(info.km)} km, au-dessus de ${fmtInt(settings.maxKm)} km`);
  }

  if (ctx.distanceKm !== undefined && ctx.distanceKm !== null && settings.zone.radiusKm > 0 && ctx.distanceKm > settings.zone.radiusKm) {
    reasons.push(`à ${Math.round(ctx.distanceKm)} km, hors du rayon de ${settings.zone.radiusKm} km`);
  }

  return { pass: reasons.length === 0, reasons, distanceKm: ctx.distanceKm ?? null };
}
