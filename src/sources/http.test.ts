import { describe, expect, it } from 'vitest';
import { fetchSite, listingsFromJsonLd } from './http.js';
import { loadFixture } from '../../tests/support/fixtures.js';

describe('json-ld', () => {
  it('reads schema.org Car items from a results page', () => {
    const html = loadFixture('pages/resultats-json-ld-une-voiture.html');
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
    const page = loadFixture('pages/resultats-liens-relatifs-sans-json-ld.html');
    const f = fake({ 'https://www.site.fr/robots.txt': { body: 'User-agent: *\nDisallow: /compte' }, 'https://www.site.fr/recherche': { body: page } });
    const r = await fetchSite('https://www.site.fr/recherche', f);
    expect(r.ok).toBe(true);
    expect(r.listings.map((l) => l.title)).toEqual(['BMW M3 Compétition', 'Ferrari F430 F1']);
    expect(r.listings[1]).toMatchObject({ externalId: '888888', price: 119000, km: 31000, year: 2006, city: 'Pessac' });
  });
});
