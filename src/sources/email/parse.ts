import * as cheerio from 'cheerio';
import type { AnyNode, Element } from 'domhandler';
import type { RawListing, SellerType } from '../../types.js';
import { cleanText, parseKm, parseLocation, parsePrice, parseYear } from '../../listings/normalize.js';
import { listingRef, SITES, siteForHost, siteForSender, unwrapTrackingUrl, type ListingRef, type SiteDef } from '../sites.js';
import { announcedCount, classifyEmail, type EmailKind, isDigestOfOlderAds } from '../../domain/sites/emailKind.js';
import { parseDepartment } from '../../domain/parsing/department.js';

export { announcedCount, classifyEmail, type EmailKind, isDigestOfOlderAds } from '../../domain/sites/emailKind.js';

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
  kind: EmailKind;
  listings: RawListing[];
  /** Tracking links that could not be unwrapped offline; resolve them over HTTP then call parse again with `resolved`. */
  pending: PendingLink[];
  ignored: number;
  announced?: number;
  /** The email's own link to the full list on the site ("Voir toutes les annonces"). */
  moreUrl?: string;
}

/** A link to the full list of results on the site, by its wording ("Voir toutes les annonces", "Je découvre…"). */
const MORE_TEXT = /toutes? les (annonces|r[ée]sultats|v[ée]hicules|offres)|tous les r[ée]sultats|voir (les )?\d+|d[ée]couvr\w* toutes|consultez toutes|voir plus d|afficher (les|toutes)/i;

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
  return { site: hint?.key, kind: classifyEmail(input.subject), listings: [], pending: [], ignored: 0, announced: announcedCount(input.subject) };
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
  let moreUrl: string | undefined;
  $('a[href]').each((_i, el) => {
    const href = ($(el).attr('href') ?? '').trim();
    if (!/^https?:/i.test(href)) return;
    const { ref, pending } = refFor(href, hint, resolved);
    const text = textOf($, el);
    if (pending) { if (!pendingSet.has(pending)) pendingSet.set(pending, text); return; }
    if (!ref) {
      ignored++;
      // "Voir toutes les annonces" (text or image caption) pointing at the site: the rest of a truncated digest.
      const caption = text || cleanText($(el).find('img').attr('alt') ?? '');
      if (!moreUrl && MORE_TEXT.test(caption)) {
        const final = resolved.get(href) ?? unwrapTrackingUrl(href).url;
        try { const u = new URL(final); if (!hint || siteForHost(u.hostname)?.key === hint.key) moreUrl = final; } catch { /* lien illisible */ }
      }
      return;
    }
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
  // Reminders and price-drop digests list ads published earlier: the email's date says nothing about them.
  const publishedAt = isDigestOfOlderAds(input.subject) ? undefined : input.date?.toISOString();
  for (const [key, group] of groups) {
    const block = findBlock($, group, key, keyOf);
    const blockText = cleanText(block.map((n) => textOf($, n)).join(' '));
    const title = pickTitle($, group, block, blockText);
    if (!title) continue;
    const ref = group[0]?.ref;
    if (!ref) continue;
    const loc = parseLocation(blockText);
    const dept = loc.postalCode ? undefined : parseDepartment(blockText);
    const listing: RawListing = {
      site: ref.site,
      siteLabel: ref.siteLabel,
      externalId: ref.id,
      url: ref.url,
      title,
      price: parsePrice(blockText),
      km: parseKm(blockText),
      year: parseYear(`${title} ${blockText}`),
      city: loc.city ?? dept?.city,
      postalCode: loc.postalCode ?? dept?.postalCode,
      sellerType: sellerType(blockText),
      description: blockText.slice(0, 600),
      imageUrl: pickImage($, block, ref.site),
      publishedAt,
      sourceRef: input.messageId,
    };
    listings.push(listing);
  }
  // The same picture on several ads is the site's illustration, not a photo of the car.
  const seen = new Map<string, number>();
  for (const l of listings) if (l.imageUrl) seen.set(l.imageUrl, (seen.get(l.imageUrl) ?? 0) + 1);
  for (const l of listings) if (l.imageUrl && (seen.get(l.imageUrl) ?? 0) > 1) l.imageUrl = undefined;

  return {
    site: hint?.key ?? listings[0]?.site,
    kind: classifyEmail(input.subject),
    listings,
    pending: [...pendingSet].map(([href, text]) => ({ href, text })),
    ignored,
    announced: announcedCount(input.subject),
    moreUrl,
  };
}

/** Lowest common ancestor of the ad's links (title, photo, price, button are often cousins in nested tables). */
function commonAncestor(head: AnyNode, els: Element[]): AnyNode {
  const chain = (el: AnyNode): AnyNode[] => { const out: AnyNode[] = []; for (let n: AnyNode | null = el; n; n = n.parent as AnyNode | null) out.push(n); return out; };
  const first = chain(head);
  const rest = els.slice(1).map((e) => new Set(chain(e)));
  return first.find((n) => rest.every((s) => s.has(n))) ?? head;
}

const isInside = (node: AnyNode, el: AnyNode): boolean => { for (let p: AnyNode | null = el; p; p = p.parent as AnyNode | null) if (p === node) return true; return false; };

/**
 * The part of the email that belongs to one ad. With several links to the ad (title, photo, price, button),
 * it is the run of rows between the first and the last of them under their common ancestor; with a single
 * link, the smallest container that also holds a price or kilometres.
 */
function findBlock($: cheerio.CheerioAPI, group: Anchor[], key: string, keyOf: (el: Element) => string | undefined): AnyNode[] {
  const els = group.map((a) => a.el as AnyNode);
  const head = els[0];
  if (!head) return [];
  if (els.length > 1) {
    const lca = commonAncestor(head, group.map((a) => a.el));
    const kids = ((lca as Element).children ?? []) as AnyNode[];
    const idx = kids.map((k, i) => (els.some((e) => isInside(k, e)) ? i : -1)).filter((i) => i >= 0);
    const last = idx[idx.length - 1];
    if (last !== undefined) {
      const range = kids.slice(idx[0], last + 1);
      const text = range.map((n) => textOf($, n)).join(' ');
      if (PRICE_OR_KM.test(text) && text.length > 20) return range;
    }
    return [climb($, lca, key, keyOf)];
  }
  return [climb($, head, key, keyOf)];
}

/** The smallest container around a node that holds a price or kilometres but no link to another ad. */
function climb($: cheerio.CheerioAPI, start: AnyNode, key: string, keyOf: (el: Element) => string | undefined): AnyNode {
  const foreignIn = (n: AnyNode) => $(n).find('a[href]').toArray().some((a) => { const k = keyOf(a as Element); return k !== undefined && k !== key; });
  let node: AnyNode = start;
  let best: AnyNode = start;
  // Wrappers that add no text (nested single-cell tables) do not count as levels.
  for (let levels = 0, steps = 0; levels < 12 && steps < 40; steps++) {
    const parent = node.parent as AnyNode | null;
    if (!parent || parent.type === 'root') break;
    if (foreignIn(parent)) break;
    const text = textOf($, parent);
    if (text.length > 1500) break;
    if (text.length !== textOf($, node).length) levels++;
    best = parent;
    node = parent;
    // Once the block carries a price or km and a reasonable amount of text, one more level is enough.
    if (PRICE_OR_KM.test(text) && text.length > 40 && levels >= 2) {
      const grand = parent.parent as AnyNode | null;
      if (!grand || grand.type === 'root') break;
      if (!foreignIn(grand) && textOf($, grand).length <= 1500) best = grand;
      break;
    }
  }
  return best;
}

/** A line of specs ("Coupé - Essence - Année 2011 - 75 000 km", "10 500 €") is not a title. */
const SPEC_LINE = /(\d[\d ]*\s?(€|km\b))|\bann[ée]e\s*:?\s*\d{4}\b|^\d{4}\b/i;

function pickTitle($: cheerio.CheerioAPI, group: Anchor[], block: AnyNode[], blockText: string): string | undefined {
  const candidates = group.map((a) => a.text).filter((t) => t.length >= 6 && !CALL_TO_ACTION.test(t) && !/^https?:/i.test(t));
  // Titles first; the longest of them wins ("Porsche 911 Carrera S" over "Porsche"). Spec lines only as a last resort.
  const texts = candidates.filter((t) => !SPEC_LINE.test(t));
  if (texts.length) return cleanTitle(texts.sort((a, b) => b.length - a.length)[0] ?? '');
  if (candidates.length) return cleanTitle(candidates.sort((a, b) => b.length - a.length)[0] ?? '');
  const headingEl = $(block).find('h1,h2,h3,h4,strong,b').first();
  const heading = headingEl[0] ? textOf($, headingEl[0]) : '';
  if (heading.length >= 6 && !CALL_TO_ACTION.test(heading)) return cleanTitle(heading);
  const alt = group.map((a) => cleanText($(a.el).find('img').attr('alt') ?? '')).find((t) => t.length >= 6);
  if (alt) return cleanTitle(alt);
  const firstLine = blockText.split(/[|•\n]/)[0]?.trim();
  return firstLine && firstLine.length >= 6 ? cleanTitle(firstLine.slice(0, 120)) : undefined;
}

function cleanTitle(t: string): string {
  return cleanText(t).replace(/\s*(\d[\d ]*\s?€.*)$/, '').replace(/\s*-\s*$/, '').slice(0, 160);
}

/**
 * The photo of the car: an image served by the site's picture host when the site is known (the rest is
 * logos, pictograms and buttons), otherwise the first visible image that is not a pictogram.
 */
function pickImage($: cheerio.CheerioAPI, block: AnyNode[], site?: string): string | undefined {
  const imgs = $(block).find('img[src]').toArray();
  const visible = (img: Element) => {
    const src = ($(img).attr('src') ?? '').trim();
    const w = Number($(img).attr('width') ?? 0);
    const h = Number($(img).attr('height') ?? 0);
    if (!/^https?:/i.test(src)) return undefined;
    if ((w && w < 40) || (h && h < 40)) return undefined;
    if (/display\s*:\s*none/i.test($(img).attr('style') ?? '')) return undefined;
    return src;
  };
  const hosts = SITES.find((s) => s.key === site)?.photoHosts;
  if (hosts?.length) {
    for (const img of imgs) {
      const src = visible(img as Element);
      if (!src) continue;
      let host = '';
      try { host = new URL(src).hostname.toLowerCase(); } catch { continue; }
      if (hosts.some((h) => host === h || host.endsWith('.' + h))) return src;
    }
    return undefined;
  }
  for (const img of imgs) {
    const src = visible(img as Element);
    if (!src) continue;
    if (/pixel|track|beacon|spacer|logo|icon|picto|button|bouton|badge|arrow|fleche|store/i.test(src)) continue;
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
      const l = cleanText(lines[j] ?? '');
      if (!l || /^https?:/.test(l) || l.length < 6 || CALL_TO_ACTION.test(l) || PRICE_OR_KM.test(l)) continue;
      if (/^\d{4}\b/.test(l) || (parseLocation(l).city && l.split(' ').length <= 4)) continue;
      title = l; break;
    }
    if (!title) return;
    const loc = parseLocation(blockText);
    listings.push({
      site: ref.site, siteLabel: ref.siteLabel, externalId: ref.id, url: ref.url, title: cleanTitle(title),
      price: parsePrice(blockText), km: parseKm(blockText), year: parseYear(blockText), city: loc.city, postalCode: loc.postalCode,
      sellerType: sellerType(blockText), description: blockText.slice(0, 600), publishedAt: isDigestOfOlderAds(input.subject) ? undefined : input.date?.toISOString(), sourceRef: input.messageId,
    });
  });
  return { site: hint?.key ?? listings[0]?.site, kind: classifyEmail(input.subject), listings, pending: [...pending].map(([href, text]) => ({ href, text })), ignored, announced: announcedCount(input.subject) };
}
