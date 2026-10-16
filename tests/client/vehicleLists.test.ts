import { describe, expect, it } from 'vitest';
import { createApiClient } from '../../client/src/api/client';
import { createHttp } from '../../client/src/api/http';
import { createVehicleLists, type VehicleLists } from '../../client/src/state/vehicleLists';
import { type FakeServer, fakeServer, json, notModified } from './support/fakeServer';
import { porscheWeekOfAlerts } from './support/vehicles';

const PAGE_ETAG = 'W/"5c-page"';

const WINDOW_ETAG = 'W/"9a-window"';

const listsServedBy = (server: FakeServer, errors: string[] = []): VehicleLists =>
  createVehicleLists({
    api: createApiClient(createHttp({ fetch: server.fetch, onUnauthorized: () => undefined })),
    showError: (text) => errors.push(text),
  });

const weekOfAlertsServer = (): FakeServer => {
  const week = porscheWeekOfAlerts(55);
  const server = fakeServer();
  server.on('GET', '/api/vehicles', (request) => {
    const limit = Number(request.query.get('limit') ?? 50);
    const cursor = request.query.get('cursor');
    const start = cursor === null ? 0 : Number(cursor);
    const page = week.slice(start, start + limit);
    const next = start + limit < week.length ? String(start + limit) : null;
    const etag = limit === 50 ? PAGE_ETAG : WINDOW_ETAG;
    if (request.headers.get('if-none-match') === etag) {
      return notModified();
    }
    return json(200, { vehicles: page, nextCursor: next }, { etag });
  });
  return server;
};

describe('liste des annonces par pages', () => {
  it('une semaine d’alertes larges : 55 Porsche 911 à traiter arrivent par 50, et « Charger plus » ajoute les 5 suivantes à la suite', async () => {
    // Given
    const server = weekOfAlertsServer();
    const lists = listsServedBy(server);
    await lists.revalidate();
    const firstPage = lists.current.value.vehicles.length;

    // When
    await lists.loadMore();

    // Then
    const shown = lists.current.value;
    expect(firstPage).toBe(50);
    expect(shown.vehicles.map((vehicle) => vehicle.id)).toEqual(porscheWeekOfAlerts(55).map((vehicle) => vehicle.id));
    expect(shown.nextCursor).toBeNull();
    expect(server.requests.map((request) => request.url)).toEqual([
      '/api/vehicles?status=nouveau',
      '/api/vehicles?status=nouveau&cursor=50',
    ]);
  });

  it('le rafraîchissement de la minute redemande la liste avec son ETag : le serveur répond qu’elle n’a pas changé, rien n’est retransféré', async () => {
    // Given
    const server = weekOfAlertsServer();
    const lists = listsServedBy(server);
    await lists.revalidate();
    const shown = lists.current.value;

    // When
    await lists.revalidate();

    // Then
    const refresh = server.requests[1];
    expect(refresh?.headers.get('if-none-match')).toBe(PAGE_ETAG);
    expect(lists.current.value).toBe(shown);
  });

  it('après « Charger plus », le rafraîchissement redemande les 55 annonces affichées d’un coup, puis seulement leur ETag', async () => {
    // Given
    const server = weekOfAlertsServer();
    const lists = listsServedBy(server);
    await lists.revalidate();
    await lists.loadMore();

    // When
    await lists.revalidate();
    await lists.revalidate();

    // Then
    const [, , firstRefresh, secondRefresh] = server.requests;
    expect(firstRefresh?.url).toBe('/api/vehicles?status=nouveau&limit=55');
    expect(firstRefresh?.headers.get('if-none-match')).toBeNull();
    expect(secondRefresh?.headers.get('if-none-match')).toBe(WINDOW_ETAG);
    expect(lists.current.value.vehicles).toHaveLength(55);
  });

  it('un rafraîchissement en arrière-plan qui échoue (réseau coupé dans un tunnel) laisse la liste affichée, sans message', async () => {
    // Given
    const server = weekOfAlertsServer();
    const errors: string[] = [];
    const lists = listsServedBy(server, errors);
    await lists.revalidate();
    server.on('GET', '/api/vehicles', () => {
      throw new TypeError('Failed to fetch');
    });

    // When
    await lists.revalidate();

    // Then
    expect(lists.current.value.vehicles).toHaveLength(50);
    expect(errors).toEqual([]);
  });

  it('« Charger plus » sans réseau dit pourquoi la suite n’arrive pas, et le bouton reste disponible', async () => {
    // Given
    const server = weekOfAlertsServer();
    const errors: string[] = [];
    const lists = listsServedBy(server, errors);
    await lists.revalidate();
    server.on('GET', '/api/vehicles', () => {
      throw new TypeError('Failed to fetch');
    });

    // When
    await lists.loadMore();

    // Then
    expect(errors).toEqual(['Failed to fetch']);
    expect(lists.current.value.loadingMore).toBe(false);
    expect(lists.current.value.nextCursor).toBe('50');
  });

  it('choisir l’onglet « Écartées par les filtres » efface la recherche et demande les écartées des marques suivies', async () => {
    // Given
    const server = fakeServer();
    server.on('GET', '/api/vehicles', () =>
      json(200, { vehicles: [], nextCursor: null, kinds: { tous: 2, suivies: 1, marque: 1, special: 0, pro: 0, km: 1, loin: 0 } }),
    );
    const lists = listsServedBy(server);
    lists.search.value = 'merignac';

    // When
    await lists.select({ status: 'ecartees', kind: 'suivies' });

    // Then
    expect(lists.search.value).toBe('');
    expect(server.requests[0]?.url).toBe('/api/vehicles?status=ecartees&kind=suivies');
    expect(lists.current.value.kinds?.suivies).toBe(1);
  });
});
