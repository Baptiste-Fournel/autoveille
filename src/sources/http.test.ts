import { describe, expect, it } from 'vitest';
import { fetchSite, listingsFromJsonLd, robotsAllows } from './http.js';

describe('robots.txt', () => {
  const robots = `User-agent: *\nDisallow: /compte/\nDisallow: /recherche*\nAllow: /recherche/public\n\nUser-agent: badbot\nDisallow: /`;
  it('applies the * group when no specific group matches', () => {
    expect(robotsAllows(robots, '/voiture-occasion/porsche')).toBe(true);
    expect(robotsAllows(robots, '/compte/alertes')).toBe(false);
    expect(robotsAllows(robots, '/recherche?x=1')).toBe(false);
    expect(robotsAllows(robots, '/recherche/public')).toBe(true);
  });
  it('blocks everything when Disallow: / applies', () => {
    expect(robotsAllows('User-agent: *\nDisallow: /', '/a')).toBe(false);
    expect(robotsAllows('User-agent: *\nDisallow:', '/a')).toBe(true);
  });
});

describe('json-ld', () => {
  it('reads schema.org Car items from a results page', () => {
    const html = `<html><head><script type="application/ld+json">${JSON.stringify({
      '@context': 'https://schema.org', '@type': 'ItemList', itemListElement: [
        { '@type': 'ListItem', position: 1, item: { '@type': 'Car', name: 'Porsche 911 Carrera S', url: '/annonce/porsche-911/123456', vehicleModelDate: '2015', mileageFromOdometer: { '@type': 'QuantitativeValue', value: 42000, unitCode: 'KMT' }, offers: { '@type': 'Offer', price: '89900', priceCurrency: 'EUR', seller: { '@type': 'Person', name: 'Marc' }, areaServed: 'Mérignac 33700' }, image: 'https://cdn.example.com/a.jpg' } },
      ] })}</script></head><body></body></html>`;
    const out = listingsFromJsonLd(html, 'https://www.example-auto.fr/recherche');
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ site: 'example-auto.fr', externalId: '123456', title: 'Porsche 911 Carrera S', year: 2015, km: 42000, price: 89900, sellerType: 'particulier', city: 'Mérignac' });
  });
});

describe('fetchSite', () => {
  const fake = (routes: Record<string, { status?: number; body: string }>): typeof fetch => (async (input: RequestInfo | URL) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
    const r = routes[url];
    if (!r) return new Response('not found', { status: 404 });
    return new Response(r.body, { status: r.status ?? 200, headers: { 'content-type': 'text/html' } });
  }) as typeof fetch;

  it('stops when robots.txt forbids the page', async () => {
    const f = fake({ 'https://www.site.fr/robots.txt': { body: 'User-agent: *\nDisallow: /' }, 'https://www.site.fr/recherche': { body: '<html></html>' } });
    const r = await fetchSite('https://www.site.fr/recherche', f);
    expect(r.ok).toBe(false);
    expect(r.detail).toMatch(/robots\.txt/);
  });

  it('reports a refusal without retrying', async () => {
    const f = fake({ 'https://www.site.fr/robots.txt': { body: '' }, 'https://www.site.fr/recherche': { status: 403, body: '' } });
    const r = await fetchSite('https://www.site.fr/recherche', f);
    expect(r.ok).toBe(false);
    expect(r.detail).toMatch(/403/);
  });

  it('falls back to link parsing with relative urls', async () => {
    const page = `<html><body><div><a href="/annonce/bmw-m3/777777">BMW M3 Compétition</a><p>79 000 €</p><p>2021 - 18 000 km</p><p>Bordeaux (33)</p></div>
      <div><a href="/annonce/ferrari-f430/888888">Ferrari F430 F1</a><p>119 000 €</p><p>2006 - 31 000 km</p><p>Pessac (33)</p></div></body></html>`;
    const f = fake({ 'https://www.site.fr/robots.txt': { body: 'User-agent: *\nDisallow: /compte' }, 'https://www.site.fr/recherche': { body: page } });
    const r = await fetchSite('https://www.site.fr/recherche', f);
    expect(r.ok).toBe(true);
    expect(r.listings.map((l) => l.title)).toEqual(['BMW M3 Compétition', 'Ferrari F430 F1']);
    expect(r.listings[1]).toMatchObject({ externalId: '888888', price: 119000, km: 31000, year: 2006, city: 'Pessac' });
  });
});
