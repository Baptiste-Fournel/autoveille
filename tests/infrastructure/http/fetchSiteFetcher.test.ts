import { describe, expect, it } from 'vitest';
import { readSitePage } from '../../../src/application/sources/readSitePage.js';
import { cheerioListingExtractor } from '../../../src/infrastructure/extraction/cheerioListingExtractor.js';
import { fetchSiteFetcher } from '../../../src/infrastructure/http/fetchSiteFetcher.js';
import { fakeClock } from '../../fakes/fakeClock.js';
import { loadFixture } from '../../support/fixtures.js';
import { type ManualTimers, manualTimers } from '../../support/manualTimers.js';
import { answering, headerSent, htmlPage, silentUntilAborted, simulatedWeb } from '../../support/simulatedWeb.js';

const RESULTS_PAGE = 'https://www.site.fr/recherche';

const ROBOTS_TXT = 'https://www.site.fr/robots.txt';

const GARAGE_PAGE = 'https://www.garage-des-graves.fr/nos-occasions';

const GARAGE_ROBOTS_TXT = 'https://www.garage-des-graves.fr/robots.txt';

const LEBONCOIN_SEARCH = 'https://www.leboncoin.fr/recherche?category=2&u_car_brand=PORSCHE';

const LEBONCOIN_ROBOTS_TXT = 'https://www.leboncoin.fr/robots.txt';

const LA_CENTRALE_LISTING = 'https://www.lacentrale.fr/listing?makesModelsCommercialNames=PORSCHE';

const LA_CENTRALE_ROBOTS_TXT = 'https://www.lacentrale.fr/robots.txt';

const NO_ROBOTS_TXT = answering('Not Found', 404);

const readThrough = (site: typeof fetch, url = RESULTS_PAGE, timers: ManualTimers = manualTimers()) =>
  readSitePage({ siteFetcher: fetchSiteFetcher(site, timers), extractor: cheerioListingExtractor(fakeClock()) }, url);

describe('lecture polie d’une page de résultats', () => {
  it('un site dont le robots.txt interdit la page : arrêt avec un message clair', async () => {
    // Given
    const web = simulatedWeb({
      [ROBOTS_TXT]: answering('User-agent: *\nDisallow: /'),
      [RESULTS_PAGE]: htmlPage('<html></html>'),
    });

    // When
    const reading = await readThrough(web.fetch);

    // Then
    expect(reading.ok).toBe(false);
    expect(reading.detail).toMatch(/robots\.txt/);
    expect(web.requested()).toEqual([ROBOTS_TXT]);
  });

  it('un robots.txt qui interdit les pages de recherche avec paramètres (Disallow: /*?) arrête la lecture d’une recherche filtrée', async () => {
    // Given
    const filteredSearch = 'https://www.site.fr/recherche?marque=porsche&km_max=100000';
    const web = simulatedWeb({
      [ROBOTS_TXT]: answering('User-agent: *\nDisallow: /*?'),
      [filteredSearch]: htmlPage(loadFixture('pages/resultats-liens-relatifs-sans-json-ld.html')),
    });

    // When
    const reading = await readThrough(web.fetch, filteredSearch);

    // Then
    expect(reading).toEqual({
      ok: false,
      detail: 'Le robots.txt du site interdit la lecture automatique de cette page. Utilisez l’alerte email du site à la place.',
      listings: [],
    });
    expect(web.requested()).toEqual([ROBOTS_TXT]);
  });

  it('un site qui répond 403 : refus signalé, sans nouvel essai', async () => {
    // Given
    const web = simulatedWeb({ [ROBOTS_TXT]: answering(''), [RESULTS_PAGE]: htmlPage('', 403) });

    // When
    const reading = await readThrough(web.fetch);

    // Then
    expect(reading.ok).toBe(false);
    expect(reading.detail).toMatch(/403/);
    expect(web.requested()).toEqual([ROBOTS_TXT, RESULTS_PAGE]);
  });

  it('une page sans JSON-LD aux liens relatifs : les annonces sont lues par leurs liens', async () => {
    // Given
    const page = loadFixture('pages/resultats-liens-relatifs-sans-json-ld.html');
    const web = simulatedWeb({ [ROBOTS_TXT]: answering('User-agent: *\nDisallow: /compte'), [RESULTS_PAGE]: htmlPage(page) });

    // When
    const reading = await readThrough(web.fetch);

    // Then
    expect(reading.ok).toBe(true);
    expect(reading.listings.map((listing) => listing.title)).toEqual(['BMW M3 Compétition', 'Ferrari F430 F1']);
    expect(reading.listings[1]).toMatchObject({ externalId: '888888', price: 119000, km: 31000, year: 2006, city: 'Pessac' });
  });

  it('AutoVeille se présente sous son nom, au robots.txt comme à la page de résultats', async () => {
    // Given
    const page = loadFixture('pages/resultats-liens-relatifs-sans-json-ld.html');
    const web = simulatedWeb({ [ROBOTS_TXT]: answering('User-agent: *\nDisallow: /compte'), [RESULTS_PAGE]: htmlPage(page) });

    // When
    await readThrough(web.fetch);

    // Then
    const requests = web.requests();
    expect(requests).toHaveLength(2);
    for (const request of requests) {
      expect(headerSent(request, 'user-agent')).toBe("AutoVeille/1.0 (veille d'annonces; respecte robots.txt)");
      expect(headerSent(request, 'accept')).toBe('text/html,application/xhtml+xml');
      expect(headerSent(request, 'accept-language')).toBe('fr-FR,fr;q=0.9');
    }
  });

  it('Leboncoin limite les lectures (HTTP 429) : refus signalé avec son code, sans nouvel essai', async () => {
    // Given
    const web = simulatedWeb({
      [LEBONCOIN_ROBOTS_TXT]: answering('User-agent: *\nDisallow: /compte/'),
      [LEBONCOIN_SEARCH]: htmlPage('', 429),
    });

    // When
    const reading = await readThrough(web.fetch, LEBONCOIN_SEARCH);

    // Then
    expect(reading).toEqual({
      ok: false,
      detail: 'Le site refuse les lectures automatiques (HTTP 429). Utilisez l’alerte email du site à la place.',
      listings: [],
    });
    expect(web.requested()).toEqual([LEBONCOIN_ROBOTS_TXT, LEBONCOIN_SEARCH]);
  });

  it('une page de résultats réservée aux membres répond 401 : refus signalé avec son code', async () => {
    // Given
    const web = simulatedWeb({ [ROBOTS_TXT]: NO_ROBOTS_TXT, [RESULTS_PAGE]: htmlPage('', 401) });

    // When
    const reading = await readThrough(web.fetch);

    // Then
    expect(reading.detail).toBe('Le site refuse les lectures automatiques (HTTP 401). Utilisez l’alerte email du site à la place.');
  });

  it('la recherche enregistrée a été supprimée par le site (HTTP 404) : réponse inattendue, sans nouvel essai', async () => {
    // Given
    const web = simulatedWeb({
      [ROBOTS_TXT]: NO_ROBOTS_TXT,
      [RESULTS_PAGE]: htmlPage('<html><head><title>Page introuvable</title></head><body>Cette page n’existe plus.</body></html>', 404),
    });

    // When
    const reading = await readThrough(web.fetch);

    // Then
    expect(reading).toEqual({ ok: false, detail: 'Réponse inattendue du site (HTTP 404).', listings: [] });
    expect(web.requested()).toEqual([ROBOTS_TXT, RESULTS_PAGE]);
  });

  it('une page « Just a moment… » de vérification anti-robot : message clair, sans contournement', async () => {
    // Given
    const web = simulatedWeb({
      [ROBOTS_TXT]: NO_ROBOTS_TXT,
      [RESULTS_PAGE]: htmlPage(loadFixture('pages/verification-anti-robot-just-a-moment.html')),
    });

    // When
    const reading = await readThrough(web.fetch);

    // Then
    expect(reading).toEqual({
      ok: false,
      detail: 'Le site présente une page de vérification anti-robot. Utilisez l’alerte email du site à la place.',
      listings: [],
    });
    expect(web.requested()).toEqual([ROBOTS_TXT, RESULTS_PAGE]);
  });

  it('La Centrale répond par une page « Access Denied » : message clair, sans contournement', async () => {
    // Given
    const web = simulatedWeb({
      [LA_CENTRALE_ROBOTS_TXT]: answering('User-agent: *\nDisallow: /compte/'),
      [LA_CENTRALE_LISTING]: htmlPage(loadFixture('pages/acces-refuse-access-denied.html')),
    });

    // When
    const reading = await readThrough(web.fetch, LA_CENTRALE_LISTING);

    // Then
    expect(reading.detail).toBe('Le site présente une page de vérification anti-robot. Utilisez l’alerte email du site à la place.');
    expect(web.requested()).toEqual([LA_CENTRALE_ROBOTS_TXT, LA_CENTRALE_LISTING]);
  });

  it('un site dont le robots.txt ne répond pas est lu quand même, après huit secondes d’attente', async () => {
    // Given
    const timers = manualTimers();
    const page = loadFixture('pages/resultats-liens-relatifs-sans-json-ld.html');
    const web = simulatedWeb({ [ROBOTS_TXT]: silentUntilAborted, [RESULTS_PAGE]: htmlPage(page) });

    // When
    const reading = readThrough(web.fetch, RESULTS_PAGE, timers);
    await timers.elapse(7_999);
    const requestedBeforeEightSeconds = web.requested();
    await timers.elapse(1);

    // Then
    expect(requestedBeforeEightSeconds).toEqual([ROBOTS_TXT]);
    expect(await reading).toMatchObject({ ok: true, detail: '2 annonce(s) lue(s) (lecture des liens).' });
    expect(web.requested()).toEqual([ROBOTS_TXT, RESULTS_PAGE]);
  });

  it('une page qui ne répond pas en quinze secondes : site injoignable, sans nouvel essai', async () => {
    // Given
    const timers = manualTimers();
    const web = simulatedWeb({ [ROBOTS_TXT]: NO_ROBOTS_TXT, [RESULTS_PAGE]: silentUntilAborted });

    // When
    const reading = readThrough(web.fetch, RESULTS_PAGE, timers);
    await timers.elapse(15_000);

    // Then
    expect(await reading).toEqual({ ok: false, detail: 'Site injoignable (This operation was aborted).', listings: [] });
    expect(web.requested()).toEqual([ROBOTS_TXT, RESULTS_PAGE]);
  });

  it('le site est injoignable (nom de domaine inconnu) : message avec la cause', async () => {
    // Given
    const web = simulatedWeb({});

    // When
    const reading = await readThrough(web.fetch);

    // Then
    expect(reading).toEqual({ ok: false, detail: 'Site injoignable (fetch failed).', listings: [] });
    expect(web.requested()).toEqual([ROBOTS_TXT, RESULTS_PAGE]);
  });

  it('une adresse collée sans « https:// » : adresse invalide, aucune requête', async () => {
    // Given
    const web = simulatedWeb({});

    // When
    const reading = await readThrough(web.fetch, 'www.leboncoin.fr/recherche?category=2');

    // Then
    expect(reading).toEqual({ ok: false, detail: 'Adresse invalide.', listings: [] });
    expect(web.requested()).toEqual([]);
  });

  it('une page de résultats qui renvoie aussi vers un autre site ne garde que les annonces de son propre hôte', async () => {
    // Given
    const page = loadFixture('pages/garage-occasions-avec-une-annonce-leboncoin-et-un-modele-non-rempli.html');
    const web = simulatedWeb({ [GARAGE_ROBOTS_TXT]: NO_ROBOTS_TXT, [GARAGE_PAGE]: htmlPage(page) });

    // When
    const reading = await readThrough(web.fetch, GARAGE_PAGE);

    // Then
    expect(reading.listings.map((listing) => listing.title)).toEqual(['Porsche 911 Carrera 4S PDK', 'Alpine A110 Légende']);
    expect(reading.listings.map((listing) => listing.url)).toEqual([
      'https://www.garage-des-graves.fr/occasion/porsche-911-carrera-4s/245871',
      'https://www.garage-des-graves.fr/occasion/alpine-a110-legende/245902',
    ]);
  });

  it('une annonce lue sur une page sans mention du vendeur a un vendeur inconnu', async () => {
    // Given
    const page = loadFixture('pages/garage-occasions-avec-une-annonce-leboncoin-et-un-modele-non-rempli.html');
    const web = simulatedWeb({ [GARAGE_ROBOTS_TXT]: NO_ROBOTS_TXT, [GARAGE_PAGE]: htmlPage(page) });

    // When
    const reading = await readThrough(web.fetch, GARAGE_PAGE);

    // Then
    expect(reading.listings[0]).toMatchObject({
      title: 'Porsche 911 Carrera 4S PDK',
      price: 98500,
      km: 42000,
      year: 2019,
      sellerType: 'inconnu',
    });
  });

  it('un lien ou une image à l’adresse illisible (modèle de page resté non rempli) est laissé tel quel, sans faire échouer la lecture', async () => {
    // Given
    const page = loadFixture('pages/garage-occasions-avec-une-annonce-leboncoin-et-un-modele-non-rempli.html');
    const web = simulatedWeb({ [GARAGE_ROBOTS_TXT]: NO_ROBOTS_TXT, [GARAGE_PAGE]: htmlPage(page) });

    // When
    const reading = await readThrough(web.fetch, GARAGE_PAGE);

    // Then
    expect(reading.ok).toBe(true);
    expect(reading.listings[1]).toMatchObject({ title: 'Alpine A110 Légende', price: 61900, km: 12500, year: 2021, city: 'Pessac' });
    expect(reading.listings[0]?.imageUrl).toBe('https://www.garage-des-graves.fr/photos/245871-1.jpg');
  });
});
