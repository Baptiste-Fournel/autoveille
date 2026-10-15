import { siteForHost } from '../domain/sites/catalog.js';

export { type SiteDef, SITES, siteForHost, siteForSender } from '../domain/sites/catalog.js';
export { type ListingRef, listingRef, prettyHost } from '../domain/sites/listingUrl.js';
export { unwrapTrackingUrl } from '../domain/sites/tracking.js';

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
        current = meta[1] ?? '';
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
