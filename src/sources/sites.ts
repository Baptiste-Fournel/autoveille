/**
 * Known classified sites: how to recognise a listing link in an alert email, how to extract its id,
 * and how the person sets up the alert. Unknown sites fall back to a generic heuristic.
 */
export interface SiteDef {
  key: string;
  label: string;
  hosts: string[];
  /** Matches the path (+ query) of a listing page. */
  listing: RegExp[];
  /** Sender domains of alert emails. */
  senders: string[];
  alertHelp: string;
}

export const SITES: SiteDef[] = [
  {
    key: 'leboncoin', label: 'Leboncoin', hosts: ['leboncoin.fr'], senders: ['leboncoin.fr'],
    listing: [/^\/ad\/[a-z_-]+\/(\d{6,})/i, /^\/voitures\/(\d{6,})\.htm/i, /^\/vi\/(\d{6,})/i],
    alertHelp: 'Faites une recherche dans Véhicules > Voitures avec vos critères (marque, rayon autour de la ville, kilométrage, vendeur particulier), puis « Sauvegarder la recherche » et activez l’alerte par email.',
  },
  {
    key: 'lacentrale', label: 'La Centrale', hosts: ['lacentrale.fr'], senders: ['lacentrale.fr'],
    listing: [/^\/auto-occasion-annonce-(\d{6,})\.html/i, /^\/annonce[^/]*\/(\d{6,})/i],
    alertHelp: 'Lancez une recherche avec vos critères, puis « Créer une alerte » (compte gratuit) et choisissez la réception par email à chaque nouvelle annonce.',
  },
  {
    key: 'autoscout24', label: 'AutoScout24', hosts: ['autoscout24.fr', 'autoscout24.com'], senders: ['autoscout24.fr', 'autoscout24.com'],
    listing: [/^\/annonces\/.*-([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i, /^\/offres\/.*-([0-9a-f-]{20,})/i],
    alertHelp: 'Après une recherche, utilisez « Enregistrer la recherche » puis activez les notifications par email dans votre compte.',
  },
  {
    key: 'paruvendu', label: 'ParuVendu', hosts: ['paruvendu.fr'], senders: ['paruvendu.fr'],
    listing: [/^\/a\/voiture-occasion\/[^/]+\/[^/]+\/([A-Za-z0-9]{6,})/i, /^\/a\/[^/]+\/.*\/([A-Za-z0-9]{8,})\/?$/i],
    alertHelp: 'Depuis la liste de résultats, cliquez « Créer une alerte » et renseignez l’adresse email dédiée.',
  },
  {
    key: 'largus', label: 'L’argus', hosts: ['largus.fr', 'occasion.largus.fr'], senders: ['largus.fr'],
    listing: [/^\/voiture-occasion\/.*?(\d{6,})/i, /^\/annonce.*?(\d{6,})/i],
    alertHelp: 'Après une recherche, « Créer une alerte » puis choisissez la fréquence « dès qu’une annonce est publiée ».',
  },
  {
    key: 'ouestfrance-auto', label: 'Ouest-France Auto', hosts: ['ouestfrance-auto.com'], senders: ['ouestfrance-auto.com', 'ouest-france.fr'],
    listing: [/^\/voiture-occasion\/.*?(\d{6,})/i],
    alertHelp: 'Sauvegardez votre recherche et activez l’alerte email.',
  },
  {
    key: 'annonces-automobile', label: 'Annonces-Automobile', hosts: ['annonces-automobile.com'], senders: ['annonces-automobile.com'],
    listing: [/^\/annonce[s]?\/.*?(\d{5,})/i, /^\/.*-(\d{6,})\.html?$/i],
    alertHelp: 'Depuis une recherche, créez une alerte email avec vos critères.',
  },
  {
    key: 'leparking', label: 'Leparking', hosts: ['leparking.fr'], senders: ['leparking.fr'],
    listing: [/^\/voiture-occasion\/.*?([0-9a-f]{8,}|\d{6,})/i],
    alertHelp: 'Leparking est un moteur de recherche qui agrège d’autres sites : utile pour couvrir d’un coup les petits sites. Créez une alerte sur une recherche sauvegardée.',
  },
];

const NON_LISTING = /(recherche|search|alerte|alert|unsubscribe|desabonn|desinscri|compte|account|login|connexion|profil|aide|help|cgu|cgv|confidentialite|privacy|contact|favoris|mes-|app-store|play\.google|apple\.com|facebook|instagram|twitter|youtube|tiktok|linkedin)/i;

export function siteForHost(host: string): SiteDef | undefined {
  const h = host.toLowerCase().replace(/^www\./, '');
  return SITES.find((s) => s.hosts.some((sh) => h === sh || h.endsWith('.' + sh)));
}

export function siteForSender(address: string): SiteDef | undefined {
  const domain = address.toLowerCase().split('@')[1] ?? '';
  return SITES.find((s) => s.senders.some((d) => domain === d || domain.endsWith('.' + d)));
}

export interface ListingRef { site: string; siteLabel: string; id: string; url: string }

/** Decide whether a URL points at a listing page, and extract its id. Unknown hosts use a generic rule. */
export function listingRef(urlStr: string, hint?: SiteDef): ListingRef | undefined {
  let u: URL;
  try { u = new URL(urlStr); } catch { return undefined; }
  const own = siteForHost(u.hostname);
  const pathAndQuery = u.pathname + (u.search || '');
  if (own) {
    for (const re of own.listing) {
      const m = re.exec(pathAndQuery);
      if (m) return { site: own.key, siteLabel: own.label, id: m[1], url: canonical(u) };
    }
    return undefined;
  }
  // An email from a known site only carries that site's ads: a link to another host (app stores,
  // social networks, partners) is never a listing.
  if (hint) return undefined;
  // Generic: a path that looks like an ad page, with a long number or a uuid in it.
  if (NON_LISTING.test(u.hostname + u.pathname)) return undefined;
  if (!/(annonce|\/ad\/|voiture|auto|occasion|vehicule|véhicule|offre|detail)/i.test(u.pathname)) return undefined;
  const uuid = /([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i.exec(u.pathname);
  const digits = u.pathname.match(/\d{5,}/g);
  const id = uuid?.[1] ?? (digits ? digits.sort((a, b) => b.length - a.length)[0] : undefined);
  if (!id) return undefined;
  const host = u.hostname.replace(/^www\./, '');
  return { site: host, siteLabel: prettyHost(host), id, url: canonical(u) };
}

function canonical(u: URL): string {
  // Drop tracking parameters but keep the path.
  const keep = new URLSearchParams();
  for (const [k, v] of u.searchParams) if (!/^(utm_|mc_|mkt_|ref|refid|src|source|campaign|fbclid|gclid|_ga|sid|eid|cid|tracking|track)/i.test(k)) keep.set(k, v);
  const q = keep.toString();
  return `${u.origin}${u.pathname}${q ? '?' + q : ''}`;
}

export function prettyHost(host: string): string {
  const base = host.replace(/^www\./, '').split('.')[0];
  return base.charAt(0).toUpperCase() + base.slice(1);
}

const TRACKING_PATH = /^\/(click|clic|clicks|r|e|ls|l|t|c|track|tracking|redirect|redir|go|url|link|links|lnk|wf|ss|uni|CL0)(\/|$)/i;
const TRACKING_SUBDOMAIN = /^(click|clic|clicks|link|links|lnk|email|emails|mail|mailing|e|em|t|r|go|url|redirect|track|tracking|news|newsletter|info|notif|notification|notifications|alert|alerte|alertes|alerts|m|msg)\./i;

/**
 * Alert emails usually wrap links in a tracking redirect. When the real URL is embedded in the
 * tracking URL (query parameter or path), we recover it here; otherwise `resolved` is false and the
 * caller follows the redirect over HTTP.
 */
export function unwrapTrackingUrl(href: string): { url: string; resolved: boolean } {
  let u: URL;
  try { u = new URL(href); } catch { return { url: href, resolved: false }; }
  const tracking = TRACKING_SUBDOMAIN.test(u.hostname);
  if (siteForHost(u.hostname) && !tracking) return { url: href, resolved: true };
  // 1. A query parameter holding the destination.
  for (const [, v] of u.searchParams) {
    const candidate = tryUrl(v) ?? tryUrl(safeDecode(v));
    if (candidate && siteForHost(candidate.hostname)) return { url: candidate.toString(), resolved: true };
  }
  // 2. The destination inlined in the path ("/click/https://www.leboncoin.fr/...").
  const inline = /https?:\/\/[^\s"'<>]+/i.exec(safeDecode(u.pathname + u.search));
  if (inline) {
    const candidate = tryUrl(inline[0]);
    if (candidate && siteForHost(candidate.hostname)) return { url: candidate.toString(), resolved: true };
  }
  // 3. A tracking redirector (subdomain or path) needs an HTTP resolve; any other unknown link is taken as is.
  if (tracking || TRACKING_PATH.test(u.pathname)) return { url: href, resolved: false };
  return { url: href, resolved: true };
}

function tryUrl(s: string): URL | undefined {
  try { return new URL(s); } catch { return undefined; }
}
function safeDecode(s: string): string {
  try { return decodeURIComponent(s); } catch { return s; }
}

/** Follow a tracking redirect to its destination (plain HTTP redirects only, no page execution). */
export async function resolveRedirect(href: string, fetchImpl: typeof fetch = fetch, maxHops = 6): Promise<string | undefined> {
  let current = href;
  for (let i = 0; i < maxHops; i++) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 8000);
    try {
      const res = await fetchImpl(current, { method: 'GET', redirect: 'manual', signal: ctrl.signal, headers: { 'user-agent': 'Mozilla/5.0 (compatible; AutoVeille/1.0)' } });
      const loc = res.headers.get('location');
      if (res.status >= 300 && res.status < 400 && loc) {
        current = new URL(loc, current).toString();
        if (siteForHost(new URL(current).hostname)) return current;
        continue;
      }
      // Some redirectors answer 200 with a meta refresh or a JS location.
      const body = res.status === 200 ? await res.text().catch(() => '') : '';
      const meta = /(?:url=|location(?:\.href)?\s*=\s*['"])(https?:\/\/[^'"\s>]+)/i.exec(body);
      if (meta) {
        current = meta[1];
        if (siteForHost(new URL(current).hostname)) return current;
        continue;
      }
      return current !== href ? current : undefined;
    } catch {
      return undefined;
    } finally {
      clearTimeout(t);
    }
  }
  return current;
}
