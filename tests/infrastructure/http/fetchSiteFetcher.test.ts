import { describe, expect, it } from 'vitest';
import { readSitePage } from '../../../src/application/sources/readSitePage.js';
import { legacyListingExtractor } from '../../../src/legacyListingExtractor.js';
import { httpSiteFetcher } from '../../../src/sources/http.js';
import { loadFixture } from '../../support/fixtures.js';

interface SiteAnswer {
  readonly status?: number;
  readonly body: string;
}

const RESULTS_PAGE = 'https://www.site.fr/recherche';

const ROBOTS_TXT = 'https://www.site.fr/robots.txt';

const addressOf = (input: Parameters<typeof fetch>[0]): string => {
  if (typeof input === 'string') {
    return input;
  }
  return input instanceof URL ? input.toString() : input.url;
};

const siteAnswering =
  (answers: Readonly<Record<string, SiteAnswer>>): typeof fetch =>
  async (input) => {
    const answer = answers[addressOf(input)];
    return answer === undefined
      ? new Response('not found', { status: 404 })
      : new Response(answer.body, { status: answer.status ?? 200, headers: { 'content-type': 'text/html' } });
  };

const readThrough = (site: typeof fetch) =>
  readSitePage({ siteFetcher: httpSiteFetcher(site), extractor: legacyListingExtractor }, RESULTS_PAGE);

describe('lecture polie d’une page de résultats', () => {
  it('un site dont le robots.txt interdit la page : arrêt avec un message clair', async () => {
    // Given
    const site = siteAnswering({ [ROBOTS_TXT]: { body: 'User-agent: *\nDisallow: /' }, [RESULTS_PAGE]: { body: '<html></html>' } });

    // When
    const reading = await readThrough(site);

    // Then
    expect(reading.ok).toBe(false);
    expect(reading.detail).toMatch(/robots\.txt/);
  });

  it('un site qui répond 403 : refus signalé, sans nouvel essai', async () => {
    // Given
    const site = siteAnswering({ [ROBOTS_TXT]: { body: '' }, [RESULTS_PAGE]: { status: 403, body: '' } });

    // When
    const reading = await readThrough(site);

    // Then
    expect(reading.ok).toBe(false);
    expect(reading.detail).toMatch(/403/);
  });

  it('une page sans JSON-LD aux liens relatifs : les annonces sont lues par leurs liens', async () => {
    // Given
    const page = loadFixture('pages/resultats-liens-relatifs-sans-json-ld.html');
    const site = siteAnswering({ [ROBOTS_TXT]: { body: 'User-agent: *\nDisallow: /compte' }, [RESULTS_PAGE]: { body: page } });

    // When
    const reading = await readThrough(site);

    // Then
    expect(reading.ok).toBe(true);
    expect(reading.listings.map((listing) => listing.title)).toEqual(['BMW M3 Compétition', 'Ferrari F430 F1']);
    expect(reading.listings[1]).toMatchObject({ externalId: '888888', price: 119000, km: 31000, year: 2006, city: 'Pessac' });
  });
});
