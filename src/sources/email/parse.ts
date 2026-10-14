import * as cheerio from 'cheerio';
import type { AnyNode, Element } from 'domhandler';
import type { RawListing, SellerType } from '../../types.js';
import { cleanText, parseKm, parseLocation, parsePrice, parseYear } from '../../listings/normalize.js';
import { listingRef, siteForSender, unwrapTrackingUrl, type ListingRef, type SiteDef } from '../sites.js';

export interface EmailInput {
  html?: string;
  text?: string;
  subject?: string;
  from?: string;
  date?: Date;
  messageId?: string;
}

export interface PendingLink { href: string; text: string }

export interface ParsedEmail {
  site?: string;
  listings: RawListing[];
  /** Tracking links that could not be unwrapped offline; resolve them over HTTP then call parse again with `resolved`. */
  pending: PendingLink[];
  ignored: number;
}

const CALL_TO_ACTION = /^(voir|voir l'annonce|voir l’annonce|détails|details|consulter|contacter|j'y vais|découvrir|cliquez|en savoir plus|voir plus|voir toutes?|afficher|ouvrir)$/i;
const PRICE_OR_KM = /(\d[\d ]*\s?(€|km\b))/i;

interface Anchor { el: Element; ref: ListingRef; text: string }

/** Text of a node with a space between every text node, so "58 900 €</p><p>2019" does not glue together. */
function textOf($: cheerio.CheerioAPI, node: AnyNode): string {
  const parts: string[] = [];
  const walk = (n: AnyNode): void => {
    if (n.type === 'text') { parts.push((n as unknown as { data: string }).data); return; }
    if (n.type === 'tag' || n.type === 'root') for (const c of (n as Element).children ?? []) walk(c);
  };
  walk(node);
  return cleanText(parts.join(' '));
}

/**
 * Turn an alert email into listings. Works on the structure every alert email shares: each ad is a
 * block with one or more links to the ad page, a title, a price, often kilometres, a year and a town.
 */
export function parseAlertEmail(input: EmailInput, resolved: Map<string, string> = new Map()): ParsedEmail {
  const hint = input.from ? siteForSender(input.from) : undefined;
  if (input.html && input.html.trim()) return parseHtml(input, hint, resolved);
  if (input.text && input.text.trim()) return parseText(input, hint, resolved);
  return { site: hint?.key, listings: [], pending: [], ignored: 0 };
}

function refFor(href: string, hint: SiteDef | undefined, resolved: Map<string, string>): { ref?: ListingRef; pending?: string } {
  const direct = resolved.get(href);
  if (direct) return { ref: listingRef(direct, hint) };
  const { url, resolved: ok } = unwrapTrackingUrl(href);
  if (ok) return { ref: listingRef(url, hint) };
  return { pending: href };
}

function parseHtml(input: EmailInput, hint: SiteDef | undefined, resolved: Map<string, string>): ParsedEmail {
  const $ = cheerio.load(input.html!);
  $('script, style, head, title').remove();

  const anchors: Anchor[] = [];
  const pendingSet = new Map<string, string>();
  let ignored = 0;
  $('a[href]').each((_i, el) => {
    const href = ($(el).attr('href') ?? '').trim();
    if (!/^https?:/i.test(href)) return;
    const { ref, pending } = refFor(href, hint, resolved);
    const text = textOf($, el);
    if (pending) { if (!pendingSet.has(pending)) pendingSet.set(pending, text); return; }
    if (!ref) { ignored++; return; }
    anchors.push({ el: el as Element, ref, text });
  });

  // Group anchors that point at the same ad (image link + title link + button).
  const groups = new Map<string, Anchor[]>();
  for (const a of anchors) {
    const key = `${a.ref.site}:${a.ref.id}`;
    const g = groups.get(key) ?? [];
    g.push(a);
    groups.set(key, g);
  }
  const keyOf = (el: Element): string | undefined => {
    const a = anchors.find((x) => x.el === el);
    return a ? `${a.ref.site}:${a.ref.id}` : undefined;
  };

  const listings: RawListing[] = [];
  for (const [key, group] of groups) {
    const block = findBlock($, group[0].el, key, keyOf);
    const blockText = textOf($, block);
    const title = pickTitle($, group, block, blockText);
    if (!title) continue;
    const ref = group[0].ref;
    const loc = parseLocation(blockText);
    const listing: RawListing = {
      site: ref.site,
      siteLabel: ref.siteLabel,
      externalId: ref.id,
      url: ref.url,
      title,
      price: parsePrice(blockText),
      km: parseKm(blockText),
      year: parseYear(`${title} ${blockText}`),
      city: loc.city,
      postalCode: loc.postalCode,
      sellerType: sellerType(blockText),
      description: blockText.slice(0, 600),
      imageUrl: pickImage($, block),
      publishedAt: input.date?.toISOString(),
      sourceRef: input.messageId,
    };
    listings.push(listing);
  }

  return {
    site: hint?.key ?? listings[0]?.site,
    listings,
    pending: [...pendingSet].map(([href, text]) => ({ href, text })),
    ignored,
  };
}

/** The smallest container around the anchor that holds its price/km but no link to another ad. */
function findBlock($: cheerio.CheerioAPI, start: Element, key: string, keyOf: (el: Element) => string | undefined): AnyNode {
  let node: AnyNode = start;
  let best: AnyNode = start;
  for (let depth = 0; depth < 12; depth++) {
    const parent = node.parent as AnyNode | null;
    if (!parent || parent.type === 'root') break;
    const foreign = $(parent).find('a[href]').toArray().some((a) => { const k = keyOf(a as Element); return k !== undefined && k !== key; });
    if (foreign) break;
    const text = textOf($, parent);
    if (text.length > 1500) break;
    best = parent;
    node = parent;
    // Once the block carries a price or km and a reasonable amount of text, one more level is enough.
    if (PRICE_OR_KM.test(text) && text.length > 40 && depth >= 2) {
      const grand = parent.parent as AnyNode | null;
      if (!grand || grand.type === 'root') break;
      const grandForeign = $(grand).find('a[href]').toArray().some((a) => { const k = keyOf(a as Element); return k !== undefined && k !== key; });
      const grandText = textOf($, grand);
      if (!grandForeign && grandText.length <= 1500) best = grand;
      break;
    }
  }
  return best;
}

function pickTitle($: cheerio.CheerioAPI, group: Anchor[], block: AnyNode, blockText: string): string | undefined {
  const texts = group.map((a) => a.text).filter((t) => t.length >= 6 && !CALL_TO_ACTION.test(t) && !/^https?:/i.test(t));
  if (texts.length) return cleanTitle(texts.sort((a, b) => b.length - a.length)[0]);
  const headingEl = $(block).find('h1,h2,h3,h4,strong,b').first();
  const heading = headingEl.length ? textOf($, headingEl[0]) : '';
  if (heading.length >= 6 && !CALL_TO_ACTION.test(heading)) return cleanTitle(heading);
  const alt = group.map((a) => cleanText($(a.el).find('img').attr('alt') ?? '')).find((t) => t.length >= 6);
  if (alt) return cleanTitle(alt);
  const firstLine = blockText.split(/[|•\n]/)[0]?.trim();
  return firstLine && firstLine.length >= 6 ? cleanTitle(firstLine.slice(0, 120)) : undefined;
}

function cleanTitle(t: string): string {
  return cleanText(t).replace(/\s*(\d[\d ]*\s?€.*)$/, '').replace(/\s*-\s*$/, '').slice(0, 160);
}

function pickImage($: cheerio.CheerioAPI, block: AnyNode): string | undefined {
  const imgs = $(block).find('img[src]').toArray();
  for (const img of imgs) {
    const src = ($(img).attr('src') ?? '').trim();
    const w = Number($(img).attr('width') ?? 0);
    const h = Number($(img).attr('height') ?? 0);
    if (!/^https?:/i.test(src)) continue;
    if ((w && w < 40) || (h && h < 40)) continue;
    if (/pixel|track|beacon|spacer|logo|icon/i.test(src)) continue;
    return src;
  }
  return undefined;
}

function sellerType(text: string): SellerType {
  if (/\b(professionnel|\bpro\b|garage|concession|société|societe)\b/i.test(text)) return 'pro';
  if (/\bparticulier\b/i.test(text)) return 'particulier';
  return 'inconnu';
}

function parseText(input: EmailInput, hint: SiteDef | undefined, resolved: Map<string, string>): ParsedEmail {
  const lines = input.text!.replace(/\r/g, '').split('\n');
  const listings: RawListing[] = [];
  const pending = new Map<string, string>();
  const seen = new Set<string>();
  let ignored = 0;
  lines.forEach((line, i) => {
    const m = /https?:\/\/[^\s<>()"']+/.exec(line);
    if (!m) return;
    const href = m[0].replace(/[.,;)]+$/, '');
    const { ref, pending: p } = refFor(href, hint, resolved);
    if (p) { pending.set(p, cleanText(lines[i - 1] ?? '')); return; }
    if (!ref) { ignored++; return; }
    const key = `${ref.site}:${ref.id}`;
    if (seen.has(key)) return;
    seen.add(key);
    const around = lines.slice(Math.max(0, i - 6), i + 4).map(cleanText).filter(Boolean);
    const blockText = around.join(' | ');
    let title: string | undefined;
    for (let j = i - 1; j >= Math.max(0, i - 8); j--) {
      const l = cleanText(lines[j]);
      if (!l || /^https?:/.test(l) || l.length < 6 || CALL_TO_ACTION.test(l) || PRICE_OR_KM.test(l)) continue;
      if (/^\d{4}\b/.test(l) || (parseLocation(l).city && l.split(' ').length <= 4)) continue;
      title = l; break;
    }
    if (!title) return;
    const loc = parseLocation(blockText);
    listings.push({
      site: ref.site, siteLabel: ref.siteLabel, externalId: ref.id, url: ref.url, title: cleanTitle(title),
      price: parsePrice(blockText), km: parseKm(blockText), year: parseYear(blockText), city: loc.city, postalCode: loc.postalCode,
      sellerType: sellerType(blockText), description: blockText.slice(0, 600), publishedAt: input.date?.toISOString(), sourceRef: input.messageId,
    });
  });
  return { site: hint?.key ?? listings[0]?.site, listings, pending: [...pending].map(([href, text]) => ({ href, text })), ignored };
}
