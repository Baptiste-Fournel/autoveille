import * as cheerio from 'cheerio';
import type { RawListing } from '../types.js';
import { parseAlertEmail } from './email/parse.js';
import { parseKm, parsePrice, parseYear, parseLocation, cleanText } from '../listings/normalize.js';
import { listingRef, prettyHost } from './sites.js';

export const USER_AGENT = 'AutoVeille/1.0 (veille d\'annonces; respecte robots.txt)';

export interface HttpSiteResult { ok: boolean; detail: string; listings: RawListing[] }

/** Minimal robots.txt check for our user agent and for "*". Prefix rules with "*" and "$" wildcards. */
export function robotsAllows(robotsTxt: string, path: string, agent = 'autoveille'): boolean {
  const groups: Array<{ agents: string[]; rules: Array<{ allow: boolean; pattern: string }> }> = [];
  let current: { agents: string[]; rules: Array<{ allow: boolean; pattern: string }> } | null = null;
  let lastWasAgent = false;
  for (const raw of robotsTxt.split(/\r?\n/)) {
    const line = raw.replace(/#.*$/, '').trim();
    if (!line) continue;
    const m = /^([a-z-]+)\s*:\s*(.*)$/i.exec(line);
    if (!m) continue;
    const key = m[1].toLowerCase(), value = m[2].trim();
    if (key === 'user-agent') {
      if (!current || !lastWasAgent) { current = { agents: [], rules: [] }; groups.push(current); }
      current.agents.push(value.toLowerCase());
      lastWasAgent = true;
    } else if ((key === 'allow' || key === 'disallow') && current) {
      current.rules.push({ allow: key === 'allow', pattern: value });
      lastWasAgent = false;
    } else {
      lastWasAgent = false;
    }
  }
  const specific = groups.filter((g) => g.agents.some((a) => a !== '*' && agent.includes(a)));
  const applicable = specific.length ? specific : groups.filter((g) => g.agents.includes('*'));
  let best: { allow: boolean; len: number } | null = null;
  for (const g of applicable) {
    for (const r of g.rules) {
      if (r.pattern === '') { if (!r.allow && !best) best = { allow: true, len: 0 }; continue; }
      const re = new RegExp('^' + r.pattern.split('*').map((s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('.*').replace(/\\\$$/, '$'));
      if (re.test(path) && (!best || r.pattern.length > best.len)) best = { allow: r.allow, len: r.pattern.length };
    }
  }
  return best ? best.allow : true;
}

interface JsonLdNode { [k: string]: unknown }

function asArray<T>(v: T | T[] | undefined | null): T[] { return v === undefined || v === null ? [] : Array.isArray(v) ? v : [v]; }

/** Vehicles described with schema.org JSON-LD (Car, Vehicle, Product with offers, ItemList of them). */
export function listingsFromJsonLd(html: string, pageUrl: string): RawListing[] {
  const $ = cheerio.load(html);
  const nodes: JsonLdNode[] = [];
  $('script[type="application/ld+json"]').each((_i, el) => {
    try {
      const data = JSON.parse($(el).text());
      const walk = (n: unknown): void => {
        if (Array.isArray(n)) { n.forEach(walk); return; }
        if (!n || typeof n !== 'object') return;
        const o = n as JsonLdNode;
        nodes.push(o);
        for (const key of ['@graph', 'itemListElement', 'item', 'mainEntity', 'offers']) if (o[key]) walk(o[key]);
      };
      walk(data);
    } catch { /* ignore invalid JSON-LD */ }
  });
  const out: RawListing[] = [];
  for (const n of nodes) {
    const type = asArray(n['@type'] as string | string[]).map((t) => String(t).toLowerCase());
    if (!type.some((t) => ['car', 'vehicle', 'product', 'motorcycle'].includes(t))) continue;
    const name = cleanText(String(n.name ?? ''));
    const url = typeof n.url === 'string' ? new URL(n.url, pageUrl).toString() : undefined;
    if (!name || !url) continue;
    const ref = listingRef(url);
    if (!ref) continue;
    const offers = asArray(n.offers as JsonLdNode | JsonLdNode[]);
    const priceRaw = offers.map((o) => o.price).find((p) => p !== undefined) ?? n.price;
    const odo = n.mileageFromOdometer as JsonLdNode | number | string | undefined;
    const km = typeof odo === 'object' && odo ? Number((odo as JsonLdNode).value) : odo !== undefined ? Number(odo) : undefined;
    const yearRaw = n.vehicleModelDate ?? n.productionDate ?? n.modelDate ?? n.releaseDate;
    const year = yearRaw ? parseYear(String(yearRaw)) : undefined;
    const seller = offers.map((o) => o.seller as JsonLdNode | undefined).find(Boolean);
    const sellerType = seller ? (asArray(seller['@type'] as string | string[]).some((t) => /organization|autodealer|localbusiness/i.test(String(t))) ? 'pro' : 'particulier') : undefined;
    const area = offers.map((o) => o.areaServed ?? o.availableAtOrFrom).find(Boolean) as JsonLdNode | string | undefined;
    const loc = parseLocation(typeof area === 'string' ? area : JSON.stringify(area ?? ''));
    const image = asArray(n.image as string | string[] | JsonLdNode)[0];
    out.push({
      site: ref.site, siteLabel: ref.siteLabel, externalId: ref.id, url: ref.url, title: name,
      price: priceRaw !== undefined ? (parsePrice(`${priceRaw} €`) ?? (Number(priceRaw) || undefined)) : undefined,
      km: km && Number.isFinite(km) ? km : undefined, year, city: loc.city, postalCode: loc.postalCode, sellerType,
      imageUrl: typeof image === 'string' ? image : typeof image === 'object' && image ? String((image as JsonLdNode).url ?? '') || undefined : undefined,
      description: cleanText(String(n.description ?? '')).slice(0, 600) || undefined,
    });
  }
  return out;
}

/** Make every link absolute so the generic block parser can recognise listing urls. */
function absolutize(html: string, pageUrl: string): string {
  const $ = cheerio.load(html);
  $('a[href]').each((_i, el) => {
    const href = $(el).attr('href');
    if (href && !/^(https?:|mailto:|tel:|javascript:|#)/i.test(href)) {
      try { $(el).attr('href', new URL(href, pageUrl).toString()); } catch { /* skip */ }
    }
  });
  $('img[src]').each((_i, el) => {
    const src = $(el).attr('src');
    if (src && !/^(https?:|data:)/i.test(src)) {
      try { $(el).attr('src', new URL(src, pageUrl).toString()); } catch { /* skip */ }
    }
  });
  return $.html();
}

/**
 * Read a search results page from a site that allows it. One plain request, identified as ourselves,
 * robots.txt honoured, no retry on refusal. Returns a clear French status for the Sources screen.
 */
export async function fetchSite(url: string, fetchImpl: typeof fetch = fetch): Promise<HttpSiteResult> {
  let u: URL;
  try { u = new URL(url); } catch { return { ok: false, detail: 'Adresse invalide.', listings: [] }; }
  const headers = { 'user-agent': USER_AGENT, accept: 'text/html,application/xhtml+xml', 'accept-language': 'fr-FR,fr;q=0.9' };
  const timeout = (ms: number) => { const c = new AbortController(); setTimeout(() => c.abort(), ms); return c.signal; };

  try {
    const robots = await fetchImpl(`${u.origin}/robots.txt`, { headers, signal: timeout(8000) });
    if (robots.ok) {
      const txt = await robots.text();
      if (!robotsAllows(txt, u.pathname + u.search)) {
        return { ok: false, detail: 'Le robots.txt du site interdit la lecture automatique de cette page. Utilisez l’alerte email du site à la place.', listings: [] };
      }
    }
  } catch {
    // No robots.txt reachable: proceed with the page request, which will tell us more.
  }

  let res: Response;
  try {
    res = await fetchImpl(u.toString(), { headers, signal: timeout(15000) });
  } catch (err) {
    return { ok: false, detail: `Site injoignable (${err instanceof Error ? err.message : String(err)}).`, listings: [] };
  }
  if (res.status === 403 || res.status === 429 || res.status === 401) {
    return { ok: false, detail: `Le site refuse les lectures automatiques (HTTP ${res.status}). Utilisez l’alerte email du site à la place.`, listings: [] };
  }
  if (!res.ok) return { ok: false, detail: `Réponse inattendue du site (HTTP ${res.status}).`, listings: [] };
  const html = await res.text();
  if (/<title>[^<]*(access denied|just a moment|attention required|captcha|vérification)/i.test(html)) {
    return { ok: false, detail: 'Le site présente une page de vérification anti-robot. Utilisez l’alerte email du site à la place.', listings: [] };
  }

  let listings = listingsFromJsonLd(html, u.toString());
  let method = 'données structurées';
  if (!listings.length) {
    listings = parseAlertEmail({ html: absolutize(html, u.toString()) }).listings;
    method = 'lecture des liens';
    // Only keep listings from this host
    listings = listings.filter((l) => { try { return new URL(l.url).hostname.replace(/^www\./, '') === u.hostname.replace(/^www\./, ''); } catch { return false; } });
  }
  for (const l of listings) { if (!l.siteLabel) l.siteLabel = prettyHost(u.hostname); }
  // The page text usually carries no explicit "particulier": leave unknown rather than guessing.
  return { ok: true, detail: `${listings.length} annonce(s) lue(s) (${method}).`, listings };
}

export { parseKm };
