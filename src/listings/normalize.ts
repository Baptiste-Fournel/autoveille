import { createHash } from 'node:crypto';
import type { RawListing, VehicleInfo } from '../types.js';
import { BRANDS, detectBrand, detectFamily, type CustomBrand } from './brands.js';

const BRAND_WORDS = new Set(BRANDS.flatMap((b) => [b.name, ...b.aliases]).flatMap((n) => n.toLowerCase().split(/[\s-]+/)));

const NBSP = /[   ]/g;

export function cleanText(s: string): string {
  return s.replace(NBSP, ' ').replace(/\s+/g, ' ').trim();
}

function toInt(s: string): number {
  return Number(s.replace(/[\s.]/g, ''));
}

/** "89 900 €", "89900€", "89.900 EUR", "Prix : 89 900" */
export function parsePrice(text: string): number | undefined {
  const t = cleanText(text);
  const plausible = (n: number): boolean => n >= 100 && n <= 5_000_000;
  // "89 900 €", "89900€", "89.900 EUR"
  const after = /(?<![\d,.\p{L}])(\d{1,3}(?:[ .]\d{3})+|\d{3,7})\s?(?:€|eur\b|euros?\b)/giu;
  let best: number | undefined;
  let m: RegExpExecArray | null;
  while ((m = after.exec(t))) {
    const n = toInt(m[1] ?? '');
    if (plausible(n) && (best === undefined || n > best)) best = n;
  }
  if (best !== undefined) return best;
  // "€ 35 500" (AutoScout24). When the kilometres follow directly ("€ 2 000 100 000 km"), the
  // greedy match swallows them: the groups before the km belong to the kilometres, not the price.
  const before = /(?:€|\beur\b|\beuros?\b)\s?(\d{1,3}(?:[ .]\d{3})*|\d{3,7})(?![\d])(\s?km\b)?/giu;
  while ((m = before.exec(t))) {
    let groups = (m[1] ?? '').split(/[ .]/);
    if (m[2] && groups.length >= 2) groups = groups.slice(0, groups.length >= 3 ? -2 : -1);
    const n = Number(groups.join(''));
    if (plausible(n) && (best === undefined || n > best)) best = n;
  }
  if (best !== undefined) return best;
  const labelled = /prix\s*:?\s*(\d{1,3}(?:[ .]\d{3})+|\d{3,7})(?![\d])/iu.exec(t);
  return labelled ? toInt(labelled[1] ?? '') : undefined;
}

/** "42 000 km", "42000km", "42.000 KM", "42 000 kms" */
export function parseKm(text: string): number | undefined {
  const t = cleanText(text);
  const re = /(?<![\d,.\p{L}])(\d{1,3}(?:[ .]\d{3})+|\d{1,7})\s?kms?\b/giu;
  let m: RegExpExecArray | null;
  while ((m = re.exec(t))) {
    const n = toInt(m[1] ?? '');
    // Reject "12 km" distance mentions and absurd values.
    if (n >= 100 && n <= 2_000_000) return n;
    // "€ 2 000 100 000 km": a price glued to the kilometres. The km are the last groups.
    const groups = (m[1] ?? '').split(/[ .]/);
    for (const k of [2, 1]) {
      if (groups.length <= k) continue;
      const tail = Number(groups.slice(-k).join(''));
      if (tail >= 1000 && tail <= 2_000_000) return tail;
    }
  }
  return undefined;
}

/** A standalone year between 1950 and next year. Prefers a labelled year ("Année : 2015", "2015 - 42 000 km"). */
export function parseYear(text: string): number | undefined {
  const t = cleanText(text);
  const max = new Date().getFullYear() + 1;
  const labelled = /(?:ann[ée]e|mise en circulation|1[èe]re main|millésime)\s*:?\s*(?:\d{2}\/)?(19[5-9]\d|20\d\d)/iu.exec(t);
  if (labelled) {
    const y = Number(labelled[1]);
    if (y <= max) return y;
  }
  const dated = /\b(?:\d{2}\/)?(19[5-9]\d|20\d\d)\b/g;
  let m: RegExpExecArray | null;
  while ((m = dated.exec(t))) {
    const y = Number(m[1]);
    const after = t.slice(m.index + m[0].length, m.index + m[0].length + 3);
    if (y <= max && !/^\s?(€|km)/i.test(after)) return y;
  }
  return undefined;
}

const LOC_STOP = new Set(['particulier', 'particuliers', 'pro', 'professionnel', 'voir', "l'annonce", 'annonce', 'prix', 'km', 'kms', 'essence', 'diesel', 'hybride', 'electrique', 'électrique', 'automatique', 'manuelle', 'boite', 'boîte', 'annee', 'année', 'kilometrage', 'kilométrage', 'neuf', 'occasion', 'contacter', 'details', 'détails', 'cliquez', 'ici', 'nouveau', 'nouvelle', 'garantie', 'ct', 'ok', 'dans', 'à', 'a', 'chez', 'par', 'vendu', 'vendeur', 'livraison', 'possible', 'gps', 'cuir', 'toit', 'jantes', 'pack', 'ch', 'cv', 'portes', 'places', 'coupe', 'coupé', 'cabriolet', 'berline', 'break', 'suv']);
const LOC_CONNECTOR = new Set(['de', 'du', 'des', 'la', 'le', 'les', 'sur', 'en', 'et', 'sous', 'aux', 'au', "d'", "l'"]);

function isCityToken(tok: string): boolean {
  const t = tok.toLowerCase();
  if (!/^[\p{L}][\p{L}'’-]*$/u.test(tok)) return false;
  if (LOC_STOP.has(t)) return false;
  // Brand names end a city: "33000 Bordeaux Porsche 911"
  return !BRAND_WORDS.has(t);
}

function trimConnectors(words: string[]): string[] {
  while (words.length && LOC_CONNECTOR.has((words[0] ?? '').toLowerCase())) words.shift();
  while (words.length && LOC_CONNECTOR.has((words[words.length - 1] ?? '').toLowerCase())) words.pop();
  return words;
}

/** "Mérignac 33700", "33700 Mérignac", "Bordeaux (33)", "Pessac - 33600", "La Teste de Buch 33260" */
export function parseLocation(text: string): { city?: string; postalCode?: string } {
  const t = cleanText(text).replace(/[|•·]/g, ' ');
  const tokens = t.split(' ').filter(Boolean);
  const isPostal = (tok: string) => /^\d{5}$/.test(tok);
  for (let i = 0; i < tokens.length; i++) {
    if (!isPostal(tokens[i] ?? '')) continue;
    // Preceded by "City" (possibly "City -")
    const before: string[] = [];
    for (let j = i - 1, n = 0; j >= 0 && n < 4; j--) {
      const tok = (tokens[j] ?? '').replace(/[,;:(]+$/, '');
      if (tok === '-' || tok === '–' || tok === '') { if (before.length) break; else continue; }
      if (!isCityToken(tok)) break;
      before.unshift(tok); n++;
    }
    const after: string[] = [];
    for (let j = i + 1, n = 0; j < tokens.length && n < 4; j++) {
      const tok = (tokens[j] ?? '').replace(/^[,;:(-]+|[,;:).]+$/g, '');
      if (!tok) continue;
      if (!isCityToken(tok)) break;
      after.push(tok); n++;
    }
    const b = trimConnectors(before), a = trimConnectors(after);
    const pick = b.length ? b : a;
    if (pick.length) return { postalCode: tokens[i], city: titleCase(pick.join(' ')) };
    return { postalCode: tokens[i] };
  }
  const m = /([\p{L}][\p{L}'’ -]{1,40}?)\s*\((\d{2})\)/u.exec(t);
  if (m) {
    const words = trimConnectors((m[1] ?? '').trim().split(' ').filter(isCityToken).slice(-4));
    if (words.length) return { postalCode: `${m[2]}000`, city: titleCase(words.join(' ')) };
  }
  return {};
}

/** 142000 -> "142 000" with a plain space (no narrow no-break space, which breaks copy/paste and search). */
export function fmtInt(n: number): string {
  return n.toLocaleString('fr-FR').replace(/[\u202f\u00a0]/g, ' ');
}

export function titleCase(s: string): string {
  return cleanText(s)
    .toLowerCase()
    .split(/(\s+|-|')/)
    .map((p) => (p.length > 1 || /\p{L}/u.test(p) ? p.charAt(0).toUpperCase() + p.slice(1) : p))
    .join('');
}

/** Strip the trailing spec soup from a model: "911 Carrera 4S 3.0 450ch PDK" -> "911 Carrera 4S" */
/** Category placeholders some sites put where the model goes ("Ford Autres - Ford ranger raptor"). */
const GENERIC_MODEL = /^(autres?|divers|other|inconnu|non renseign[ée]|nc)$/i;

export function extractModel(title: string, modelStart: number): string | undefined {
  const rest = cleanText(title.slice(modelStart)).replace(/^[-–:,|]+\s*/, '');
  if (!rest) return undefined;
  if (GENERIC_MODEL.test(rest.split(' ')[0] ?? '')) return undefined;
  const tokens = rest.split(' ');
  const out: string[] = [];
  for (const tok of tokens) {
    if (out.length >= 3) break;
    // "Ranger RANGER DOUBLE CABINE": a token repeated right after itself is noise.
    if (out.length && tok.localeCompare(out[out.length - 1] ?? '', 'fr', { sensitivity: 'base' }) === 0) continue;
    // stop at a spec token: "3.0", "450ch", "PDK", "BVA", "2015", "42000km", "diesel"
    // ("Série 3", "DS 5", "Golf 7": a small number right after the first word is part of the name)
    if (/^\d+([.,]\d+)?[lL]?$/.test(tok) && out.length > 0 && !/^\d{3,4}$/.test(tok) && !(out.length === 1 && /^\d{1,2}$/.test(tok))) break;
    if (/^\d+(ch|cv|kw|km|l)$/i.test(tok) && out.length > 0) break; // "2cv", "4cv": a model when it comes first
    if (/^(19|20)\d\d$/.test(tok)) break;
    if (/^(pdk|bva|bvm|dsg|tiptronic|auto|automatique|manuelle|diesel|essence|hybride|electrique|électrique|dci|tdi|hdi|tfsi|tsi|cdi|phev|4x4|4wd|awd|occasion|neuf|garantie|ct|ok)$/i.test(tok)) break;
    if (/^[-–|,:]$/.test(tok)) break;
    out.push(tok);
  }
  return out.length ? out.join(' ') : undefined;
}

export function extractVehicleInfo(raw: RawListing, extra: CustomBrand[] = []): VehicleInfo {
  const title = cleanText(raw.title);
  const blob = `${title} ${raw.description ?? ''}`;
  const inTitle = detectBrand(title, extra);
  const brand = inTitle ?? detectBrand(blob, extra);
  let model = brand ? extractModel(title, inTitle ? brand.modelStart : title.length) : undefined;
  // "Ford Autres - Ford ranger raptor": the site's placeholder hides the model, which the seller's own
  // words give after the separator (often starting with the brand again).
  if (brand && inTitle && model === undefined) {
    const after = cleanText(title.slice(inTitle.modelStart)).replace(/^\S+\s*/, '').replace(/^[-–:,|]+\s*/, '');
    if (after) {
      const again = detectBrand(after, extra);
      model = (again && again.make === brand.make ? extractModel(after, again.modelStart) : undefined) ?? extractModel(after, 0);
      if (model && fold(model) === fold(brand.make)) model = undefined; // "Renault 1929": only the brand was left
    }
  }
  const family = detectFamily(brand?.make, model, blob, extra);
  return {
    make: brand?.make,
    model,
    family,
    year: raw.year ?? parseYear(blob),
    km: raw.km ?? parseKm(blob),
    price: raw.price ?? parsePrice(blob),
  };
}

function fold(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

/**
 * Coarse identity of a vehicle across sites and reposts: make, model, year and département.
 * Two cars with the same key are the same vehicle when `similar()` also agrees on km / price.
 */
export function fingerprint(info: VehicleInfo, raw: RawListing): string {
  const parts = [
    fold(info.make ?? 'inconnu'),
    fold(info.model ?? fold(raw.title).split(' ').slice(0, 3).join(' ')),
    String(info.year ?? 'x'),
    raw.postalCode?.slice(0, 2) ?? 'xx',
  ];
  return createHash('sha1').update(parts.join('|')).digest('hex').slice(0, 16);
}

/**
 * Same car? Kilometres within 5 000 km (or 10 %) and, when both prices are known, price within 15 %
 * (a repost often comes with a small price cut; two different cars of the same model rarely agree on
 * both). When km is unknown on one side, price alone decides, within 10 %.
 */
export function similar(a: { km?: number | null; price?: number | null }, b: { km?: number | null; price?: number | null }): boolean {
  const ak = a.km ?? undefined, bk = b.km ?? undefined, ap = a.price ?? undefined, bp = b.price ?? undefined;
  const priceClose = (tol: number) => ap === undefined || bp === undefined || Math.abs(ap - bp) <= tol * Math.max(ap, bp);
  if (ak !== undefined && bk !== undefined) {
    return Math.abs(ak - bk) <= Math.max(5000, 0.1 * Math.max(ak, bk)) && priceClose(0.15);
  }
  if (ap !== undefined && bp !== undefined) return priceClose(0.1);
  return true;
}
