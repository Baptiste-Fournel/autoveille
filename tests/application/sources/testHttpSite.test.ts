import { describe, expect, it } from 'vitest';
import { testHttpSite } from '../../../src/application/sources/testHttpSite.js';
import { fakeListingExtractor } from '../../fakes/fakeListingExtractor.js';
import { fakeSiteFetcher } from '../../fakes/fakeSiteFetcher.js';
import { LEPARKING_BMW_M3_RESULTS, LEPARKING_BMW_M3_SEARCH } from '../../support/leparkingListings.js';

const LACENTRALE_PORSCHE_SEARCH = 'https://www.lacentrale.fr/listing?makesModelsCommercialNames=PORSCHE';
const AUTOSCOUT24_PORSCHE_SEARCH = 'https://www.autoscout24.fr/lst/porsche/911';

describe('tester une page de résultats lue directement', () => {
  it('sans adresse, le test demande l’adresse de la page sans rien lire', async () => {
    // Given
    const siteFetcher = fakeSiteFetcher();
    const extractor = fakeListingExtractor();

    // When
    const result = await testHttpSite({ siteFetcher, extractor }, '   ');

    // Then
    expect(result).toEqual({ ok: false, detail: 'Indiquez l’adresse de la page de résultats.' });
    expect(siteFetcher.requested()).toEqual([]);
  });

  it('la recherche Leparking des BMW M3, lue par ses données structurées : six annonces, les cinq premières en aperçu', async () => {
    // Given
    const html = '<html><script type="application/ld+json">…</script></html>';
    const siteFetcher = fakeSiteFetcher({ [LEPARKING_BMW_M3_SEARCH]: { kind: 'page', url: LEPARKING_BMW_M3_SEARCH, html } });
    const extractor = fakeListingExtractor({
      pages: { [LEPARKING_BMW_M3_SEARCH]: { listings: LEPARKING_BMW_M3_RESULTS, method: 'structuredData' } },
    });

    // When
    const result = await testHttpSite({ siteFetcher, extractor }, ` ${LEPARKING_BMW_M3_SEARCH} `);

    // Then
    expect(result).toEqual({
      ok: true,
      detail: '6 annonce(s) lue(s) (données structurées).',
      sample: LEPARKING_BMW_M3_RESULTS.slice(0, 5),
    });
    expect(siteFetcher.requested()).toEqual([LEPARKING_BMW_M3_SEARCH]);
    expect(extractor.pagesRead()).toEqual([{ url: LEPARKING_BMW_M3_SEARCH, html }]);
  });

  it('une page sans données structurées est lue par ses liens, et le test le dit', async () => {
    // Given
    const siteFetcher = fakeSiteFetcher({ [LEPARKING_BMW_M3_SEARCH]: { kind: 'page', url: LEPARKING_BMW_M3_SEARCH, html: '<ul>…</ul>' } });
    const extractor = fakeListingExtractor({
      pages: { [LEPARKING_BMW_M3_SEARCH]: { listings: LEPARKING_BMW_M3_RESULTS.slice(0, 2), method: 'links' } },
    });

    // When
    const result = await testHttpSite({ siteFetcher, extractor }, LEPARKING_BMW_M3_SEARCH);

    // Then
    expect(result.detail).toBe('2 annonce(s) lue(s) (lecture des liens).');
  });

  it('La Centrale interdit la lecture automatique dans son robots.txt : message clair, une seule demande, rien n’est extrait', async () => {
    // Given
    const siteFetcher = fakeSiteFetcher({ [LACENTRALE_PORSCHE_SEARCH]: { kind: 'disallowedByRobots' } });
    const extractor = fakeListingExtractor();

    // When
    const result = await testHttpSite({ siteFetcher, extractor }, LACENTRALE_PORSCHE_SEARCH);

    // Then
    expect(result).toEqual({
      ok: false,
      detail: 'Le robots.txt du site interdit la lecture automatique de cette page. Utilisez l’alerte email du site à la place.',
      sample: [],
    });
    expect(siteFetcher.requested()).toEqual([LACENTRALE_PORSCHE_SEARCH]);
    expect(extractor.pagesRead()).toEqual([]);
  });

  it('un site qui répond 403 : refus signalé avec son code, sans nouvel essai', async () => {
    // Given
    const siteFetcher = fakeSiteFetcher({ [AUTOSCOUT24_PORSCHE_SEARCH]: { kind: 'refused', status: 403 } });
    const extractor = fakeListingExtractor();

    // When
    const result = await testHttpSite({ siteFetcher, extractor }, AUTOSCOUT24_PORSCHE_SEARCH);

    // Then
    expect(result.detail).toBe('Le site refuse les lectures automatiques (HTTP 403). Utilisez l’alerte email du site à la place.');
    expect(siteFetcher.requested()).toEqual([AUTOSCOUT24_PORSCHE_SEARCH]);
  });

  it('une page « Just a moment… » de vérification anti-robot : message clair, sans contournement', async () => {
    // Given
    const siteFetcher = fakeSiteFetcher({ [AUTOSCOUT24_PORSCHE_SEARCH]: { kind: 'antiBotPage' } });
    const extractor = fakeListingExtractor();

    // When
    const result = await testHttpSite({ siteFetcher, extractor }, AUTOSCOUT24_PORSCHE_SEARCH);

    // Then
    expect(result.detail).toBe('Le site présente une page de vérification anti-robot. Utilisez l’alerte email du site à la place.');
    expect(siteFetcher.requested()).toEqual([AUTOSCOUT24_PORSCHE_SEARCH]);
  });

  it('une recherche collée sans adresse web (« leboncoin voitures bordeaux ») : adresse invalide', async () => {
    // Given
    const typed = 'leboncoin voitures bordeaux';
    const siteFetcher = fakeSiteFetcher({ [typed]: { kind: 'invalidAddress' } });
    const extractor = fakeListingExtractor();

    // When
    const result = await testHttpSite({ siteFetcher, extractor }, typed);

    // Then
    expect(result).toEqual({ ok: false, detail: 'Adresse invalide.', sample: [] });
  });

  it('un site en panne qui répond 500 : réponse inattendue, avec son code', async () => {
    // Given
    const siteFetcher = fakeSiteFetcher({ [LEPARKING_BMW_M3_SEARCH]: { kind: 'unexpectedStatus', status: 500 } });
    const extractor = fakeListingExtractor();

    // When
    const result = await testHttpSite({ siteFetcher, extractor }, LEPARKING_BMW_M3_SEARCH);

    // Then
    expect(result.detail).toBe('Réponse inattendue du site (HTTP 500).');
  });

  it('un site dont le nom ne se résout pas : injoignable, avec le message du réseau', async () => {
    // Given
    const siteFetcher = fakeSiteFetcher({
      [LEPARKING_BMW_M3_SEARCH]: { kind: 'unreachable', message: 'getaddrinfo ENOTFOUND www.leparking.fr' },
    });
    const extractor = fakeListingExtractor();

    // When
    const result = await testHttpSite({ siteFetcher, extractor }, LEPARKING_BMW_M3_SEARCH);

    // Then
    expect(result.detail).toBe('Site injoignable (getaddrinfo ENOTFOUND www.leparking.fr).');
  });
});
