import { type SiteDef, siteForHost } from './catalog.js';

export interface ListingRef {
  readonly site: string;
  readonly siteLabel: string;
  readonly id: string;
  readonly url: string;
}

const NOT_A_LISTING =
  /(recherche|search|alerte|alert|unsubscribe|desabonn|desinscri|compte|account|login|connexion|profil|aide|help|cgu|cgv|confidentialite|privacy|contact|favoris|mes-|app-store|play\.google|apple\.com|facebook|instagram|twitter|youtube|tiktok|linkedin)/i;

const LISTING_PAGE_WORDS = /(annonce|\/ad\/|voiture|auto|occasion|vehicule|véhicule|offre|detail)/i;

const UUID = /([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i;

export const withoutWww = (host: string): string => host.replace(/^www\./, '');

const TRACKING_QUERY_PARAMETER =
  /^(utm_|mc_|mkt_|ref|refid|src|source|campaign|fbclid|gclid|_ga|sid|eid|cid|tracking|track|cldtidx|ap_tier|position|pos$|idAlerte|ticket|xtor|mailUniqId|mailUniqIdAno|at_|pk_|mkt)/i;

export function prettyHost(host: string): string {
  const base = withoutWww(host).split('.')[0] ?? '';
  return base.charAt(0).toUpperCase() + base.slice(1);
}

function canonical(url: URL): string {
  const kept = new URLSearchParams();
  for (const [name, value] of url.searchParams) {
    if (!TRACKING_QUERY_PARAMETER.test(name)) {
      kept.set(name, value);
    }
  }
  const query = kept.toString();
  return `${url.origin}${url.pathname}${query ? `?${query}` : ''}`;
}

const longestDigitRun = (path: string): string | undefined =>
  path.match(/\d{5,}/g)?.reduce((longest, digits) => (digits.length > longest.length ? digits : longest));

function knownSiteListing(url: URL, site: SiteDef): ListingRef | undefined {
  const pathAndQuery = url.pathname + (url.search || '');
  const match = site.listingPathPatterns.map((pattern) => pattern.exec(pathAndQuery)).find((found) => found !== null);
  return match ? { site: site.key, siteLabel: site.label, id: match[1] ?? '', url: canonical(url) } : undefined;
}

function genericListing(url: URL): ListingRef | undefined {
  if (NOT_A_LISTING.test(url.hostname + url.pathname) || !LISTING_PAGE_WORDS.test(url.pathname)) {
    return undefined;
  }
  const id = UUID.exec(url.pathname)?.[1] ?? longestDigitRun(url.pathname);
  if (!id) {
    return undefined;
  }
  const host = withoutWww(url.hostname);
  return { site: host, siteLabel: prettyHost(host), id, url: canonical(url) };
}

export function listingRef(href: string, emailSite?: SiteDef): ListingRef | undefined {
  if (!URL.canParse(href)) {
    return undefined;
  }
  const url = new URL(href);
  const site = siteForHost(url.hostname);
  if (site) {
    return knownSiteListing(url, site);
  }
  return emailSite ? undefined : genericListing(url);
}
