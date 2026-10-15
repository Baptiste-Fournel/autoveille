import { evaluate as evaluateVerdict, specialReason as specialReasonOf } from '../domain/filtering/evaluate.js';
import { describeRejection } from '../domain/presentation/reasons.js';
import { describeSpecialReason } from '../domain/presentation/specialReasons.js';
import type { Family, FilterResult, RawListing, Settings, VehicleInfo } from '../types.js';

export function specialReason(family: Family, info: VehicleInfo, raw: RawListing, settings: Settings): string | undefined {
  const reason = specialReasonOf(settings.families[family], info, raw);
  return reason === undefined ? undefined : describeSpecialReason(reason);
}

export type ReasonKind = 'marque' | 'special' | 'pro' | 'km' | 'loin' | 'autre';

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
  const distanceKm = ctx.distanceKm ?? null;
  const verdict = evaluateVerdict(raw, info, settings, distanceKm);
  return { pass: verdict.pass, reasons: verdict.rejections.map(describeRejection), distanceKm };
}
