import * as cheerio from 'cheerio';
import type { FetchedPage, PageReading } from '../application/ports/listingExtractor.js';
import type { SiteFetcher, SitePage } from '../application/ports/siteFetcher.js';
import type { RawListing } from '../types.js';
import { parseAlertEmail } from './email/parse.js';
import { parsePrice, parseYear, parseLocation, cleanText } from '../listings/normalize.js';
import { listingRef, prettyHost } from './sites.js';
import { robotsAllows } from '../domain/sites/robots.js';

export { robotsAllows } from '../domain/sites/robots.js';

export const USER_AGENT = 'AutoVeille/1.0 (veille d\'annonces; respecte robots.txt)';

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

const ANTI_BOT_PAGE = /<title>[^<]*(access denied|just a moment|attention required|captcha|vérification)/i;

const REFUSED_STATUSES = [401, 403, 429];

const ROBOTS_TIMEOUT_MS = 8_000;

const PAGE_TIMEOUT_MS = 15_000;

const PAGE_HEADERS = { 'user-agent': USER_AGENT, accept: 'text/html,application/xhtml+xml', 'accept-language': 'fr-FR,fr;q=0.9' };

const abortAfter = (ms: number): AbortSignal => {
  const controller = new AbortController();
  setTimeout(() => controller.abort(), ms);
  return controller.signal;
};

const robotsForbid = async (page: URL, fetchImpl: typeof fetch): Promise<boolean> => {
  try {
    const robots = await fetchImpl(`${page.origin}/robots.txt`, { headers: PAGE_HEADERS, signal: abortAfter(ROBOTS_TIMEOUT_MS) });
    return robots.ok && !robotsAllows(await robots.text(), page.pathname + page.search);
  } catch {
    return false;
  }
};

const requested = (page: URL, fetchImpl: typeof fetch): Promise<{ readonly response: Response } | { readonly failure: string }> =>
  fetchImpl(page.toString(), { headers: PAGE_HEADERS, signal: abortAfter(PAGE_TIMEOUT_MS) }).then(
    (response) => ({ response }),
    (error: unknown) => ({ failure: error instanceof Error ? error.message : String(error) }),
  );

export async function fetchPage(url: string, fetchImpl: typeof fetch): Promise<SitePage> {
  if (!URL.canParse(url)) return { kind: 'invalidAddress' };
  const page = new URL(url);
  if (await robotsForbid(page, fetchImpl)) return { kind: 'disallowedByRobots' };
  const answer = await requested(page, fetchImpl);
  if ('failure' in answer) return { kind: 'unreachable', message: answer.failure };
  const { response } = answer;
  if (REFUSED_STATUSES.includes(response.status)) return { kind: 'refused', status: response.status };
  if (!response.ok) return { kind: 'unexpectedStatus', status: response.status };
  const html = await response.text();
  if (ANTI_BOT_PAGE.test(html)) return { kind: 'antiBotPage' };
  return { kind: 'page', url: page.toString(), html };
}

export const httpSiteFetcher = (fetchImpl?: typeof fetch): SiteFetcher => ({
  fetchPage: (url) => fetchPage(url, fetchImpl ?? fetch),
});

const hostOf = (url: string): string | undefined => (URL.canParse(url) ? new URL(url).hostname.replace(/^www\./, '') : undefined);

const withSiteLabel = (listings: readonly RawListing[], hostname: string): readonly RawListing[] =>
  listings.map((listing) => (listing.siteLabel ? listing : { ...listing, siteLabel: prettyHost(hostname) }));

export function listingsFromPage(page: FetchedPage): PageReading {
  const { hostname } = new URL(page.url);
  const structured = listingsFromJsonLd(page.html, page.url);
  if (structured.length) return { listings: withSiteLabel(structured, hostname), method: 'structuredData' };
  const pageHost = hostname.replace(/^www\./, '');
  const linked = parseAlertEmail({ html: absolutize(page.html, page.url) }).listings.filter((listing) => hostOf(listing.url) === pageHost);
  return { listings: withSiteLabel(linked, hostname), method: 'links' };
}
