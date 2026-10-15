import { describe, expect, it } from 'vitest';
import type { SitePage } from '../../../src/application/ports/siteFetcher.js';
import { fetchHttpSites, httpSitesFetching } from '../../../src/application/sources/fetchHttpSites.js';
import type { HttpSite } from '../../../src/domain/settings/types.js';
import { fakeListingExtractor } from '../../fakes/fakeListingExtractor.js';
import { fakeSiteFetcher } from '../../fakes/fakeSiteFetcher.js';
import { settingsWithDealerMailbox } from '../../support/dealerMailbox.js';
import { LEPARKING_BMW_M3_RESULTS, LEPARKING_BMW_M3_SEARCH } from '../../support/leparkingListings.js';
import { mailWorld } from '../../support/mailWorld.js';

const LACENTRALE_PORSCHE_SEARCH = 'https://www.lacentrale.fr/listing?makesModelsCommercialNames=PORSCHE';
const LEBONCOIN_911_SEARCH = 'https://www.leboncoin.fr/recherche?category=2&text=porsche%20911';

const leparking: HttpSite = { id: 'k3v9x2ab', name: 'Leparking', url: LEPARKING_BMW_M3_SEARCH, enabled: true };
const laCentrale: HttpSite = { id: 'p7q2m4cd', name: 'La Centrale', url: LACENTRALE_PORSCHE_SEARCH, enabled: true };

const leparkingPage: SitePage = { kind: 'page', url: LEPARKING_BMW_M3_SEARCH, html: '<html>…</html>' };

const httpWorld = (httpSites: readonly HttpSite[], pages: Readonly<Record<string, SitePage>>) => {
  const world = mailWorld([], { settings: settingsWithDealerMailbox({ httpSites }) });
  return {
    ...world,
    siteFetcher: fakeSiteFetcher(pages),
    extractor: fakeListingExtractor({
      pages: { [LEPARKING_BMW_M3_SEARCH]: { listings: LEPARKING_BMW_M3_RESULTS, method: 'structuredData' } },
    }),
  };
};

describe('lecture des sites lus directement', () => {
  it('la recherche Leparking des BMW M3 : six annonces lues, trois nouvelles retenues, et le passage le dit sur l’écran Sites', async () => {
    // Given
    const world = httpWorld([leparking], { [LEPARKING_BMW_M3_SEARCH]: leparkingPage });

    // When
    const summaries = await fetchHttpSites(world);

    // Then
    const detail = '6 annonce(s) lue(s) (données structurées). 3 nouvelle(s) correspondant aux réglages.';
    expect(summaries).toEqual([{ source: 'Leparking', ok: true, detail }]);
    expect(world.sourceRuns.all()).toEqual([{ source: 'http:k3v9x2ab', lastRunAt: '2026-10-15T08:30:00.000Z', ok: true, detail }]);
    expect(world.vehicles.allVehicles()).toHaveLength(6);
  });

  it('relue le lendemain, la même recherche ne compte plus aucune nouvelle annonce', async () => {
    // Given
    const world = httpWorld([leparking], { [LEPARKING_BMW_M3_SEARCH]: leparkingPage });
    await fetchHttpSites(world);
    world.clock.advanceBy(86_400_000);

    // When
    const summaries = await fetchHttpSites(world);

    // Then
    expect(summaries.map((summary) => summary.detail)).toEqual([
      '6 annonce(s) lue(s) (données structurées). 0 nouvelle(s) correspondant aux réglages.',
    ]);
    expect(world.vehicles.allVehicles()).toHaveLength(6);
  });

  it('La Centrale interdite par son robots.txt : le refus est enregistré tel quel, et la recherche Leparking est lue quand même', async () => {
    // Given
    const world = httpWorld([laCentrale, leparking], {
      [LACENTRALE_PORSCHE_SEARCH]: { kind: 'disallowedByRobots' },
      [LEPARKING_BMW_M3_SEARCH]: leparkingPage,
    });

    // When
    const summaries = await fetchHttpSites(world);

    // Then
    const refusal = 'Le robots.txt du site interdit la lecture automatique de cette page. Utilisez l’alerte email du site à la place.';
    expect(summaries).toEqual([
      { source: 'La Centrale', ok: false, detail: refusal },
      { source: 'Leparking', ok: true, detail: '6 annonce(s) lue(s) (données structurées). 3 nouvelle(s) correspondant aux réglages.' },
    ]);
    expect(world.sourceRuns.all()[0]).toEqual({
      source: 'http:p7q2m4cd',
      lastRunAt: '2026-10-15T08:30:00.000Z',
      ok: false,
      detail: refusal,
    });
  });

  it('Leboncoin limite les lectures (HTTP 429) : le refus est enregistré, sans nouvel essai', async () => {
    // Given
    const leboncoin: HttpSite = { id: 'w8r5t1ef', name: 'Leboncoin', url: LEBONCOIN_911_SEARCH, enabled: true };
    const world = httpWorld([leboncoin], { [LEBONCOIN_911_SEARCH]: { kind: 'refused', status: 429 } });

    // When
    const summaries = await fetchHttpSites(world);

    // Then
    expect(summaries.map((summary) => summary.detail)).toEqual([
      'Le site refuse les lectures automatiques (HTTP 429). Utilisez l’alerte email du site à la place.',
    ]);
    expect(world.siteFetcher.requested()).toEqual([LEBONCOIN_911_SEARCH]);
  });

  it('un site désactivé après un refus, ou ajouté sans adresse, n’est pas lu', async () => {
    // Given
    const world = httpWorld(
      [
        { ...laCentrale, enabled: false },
        { id: 'z1y2x3wv', name: 'Site', url: '', enabled: true },
      ],
      {},
    );

    // When
    const summaries = await fetchHttpSites(world);

    // Then
    expect(summaries).toEqual([]);
    expect(world.siteFetcher.requested()).toEqual([]);
    expect(world.sourceRuns.all()).toEqual([]);
  });
});

describe('une seule lecture des sites à la fois', () => {
  it('une vérification demandée pendant la lecture des sites ne relance pas de lecture et ne rend rien', async () => {
    // Given
    const world = httpWorld([leparking], { [LEPARKING_BMW_M3_SEARCH]: leparkingPage });
    const fetching = httpSitesFetching(world);

    // When
    const [scheduled, requested] = await Promise.all([fetching.fetchAll(), fetching.fetchAll()]);

    // Then
    expect(scheduled).toHaveLength(1);
    expect(requested).toEqual([]);
    expect(world.siteFetcher.requested()).toEqual([LEPARKING_BMW_M3_SEARCH]);
  });

  it('une fois la lecture terminée, la vérification suivante relit les sites', async () => {
    // Given
    const world = httpWorld([leparking], { [LEPARKING_BMW_M3_SEARCH]: leparkingPage });
    const fetching = httpSitesFetching(world);
    await fetching.fetchAll();

    // When
    const next = await fetching.fetchAll();

    // Then
    expect(next).toHaveLength(1);
    expect(world.siteFetcher.requested()).toEqual([LEPARKING_BMW_M3_SEARCH, LEPARKING_BMW_M3_SEARCH]);
  });
});
