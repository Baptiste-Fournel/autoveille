import { act, fireEvent, screen, waitFor } from '@testing-library/preact';
import { describe, expect, it } from 'vitest';
import type { Status, VehicleDto, VehicleUpdateRequest } from '../../src/shared/api';
import { type FakeServer, json } from './support/fakeServer';
import { browserOpeningListings, isShown } from './support/listingTab';
import { renderedApplication, serverForSignedInDealer } from './support/testApplication';
import { alpineA110Pessac, ferrari360Langon, overviewWith, porsche911Merignac, porscheWeekOfAlerts } from './support/vehicles';

interface Dealership {
  readonly server: FakeServer;
  readonly handledElsewhere: (id: number, status: Status) => void;
}

const dealershipWith = (vehicles: readonly VehicleDto[]): Dealership => {
  const statuses = new Map(vehicles.map((vehicle) => [vehicle.id, vehicle.status]));
  const current = (vehicle: VehicleDto): VehicleDto => ({ ...vehicle, status: statuses.get(vehicle.id) ?? vehicle.status });
  const server = serverForSignedInDealer();
  server.on('GET', '/api/overview', () => json(200, overviewWith({ nouveau: vehicles.length })));
  server.on('GET', '/api/vehicles', () =>
    json(200, { vehicles: vehicles.map(current).filter((vehicle) => vehicle.status === 'nouveau'), nextCursor: null }),
  );
  for (const vehicle of vehicles) {
    server.on('POST', `/api/vehicles/${vehicle.id}`, (request) => {
      const change: VehicleUpdateRequest = typeof request.body === 'object' && request.body !== null ? request.body : {};
      const status = change.doNotContact === true ? 'ignore' : change.status;
      if (status === 'nouveau' || status === 'contacte' || status === 'ignore') {
        statuses.set(vehicle.id, status);
      }
      return json(200, current(vehicle));
    });
  }
  return { server, handledElsewhere: (id, status) => statuses.set(id, status) };
};

const threeToHandle = (): Dealership => dealershipWith([porsche911Merignac(), alpineA110Pessac(), ferrari360Langon()]);

const inBurst = (): void => {
  window.history.replaceState(null, '', '/#/rafale');
};

const shownName = (): string | null | undefined => document.querySelector('article.detail h2')?.textContent;

const progressText = (): string | null | undefined => document.querySelector('.progress b')?.textContent;

const confirmation = (): HTMLElement => {
  const box = screen.getByText('Message envoyé au vendeur ?').closest('.confirm');
  if (!(box instanceof HTMLElement)) {
    throw new Error('Pas de confirmation');
  }
  return box;
};

const openTheListing = async (): Promise<void> => {
  fireEvent.click(screen.getByRole('button', { name: 'Ouvrir l’annonce et copier le message' }));
  await waitFor(() =>
    expect(screen.getByRole('status').textContent).toBe('Message copié : collez-le dans le formulaire de contact de l’annonce.'),
  );
};

const sentAndNext = async (next: string): Promise<void> => {
  await openTheListing();
  fireEvent.click(screen.getByRole('button', { name: 'Oui, envoyé, suivante' }));
  await waitFor(() => expect(shownName()).toBe(next));
};

describe('mode rafale', () => {
  it('en rafale, le bouton « Ouvrir l’annonce et copier le message » précède le message replié', async () => {
    // Given
    inBurst();

    // When
    await renderedApplication(threeToHandle().server);

    // Then
    await waitFor(() => expect(shownName()).toBe('Porsche 911 Carrera S'));
    expect(progressText()).toBe('1 sur 3');
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Mode rafale');
    const sheet = document.querySelector('article.detail');
    expect(Array.from(sheet?.children ?? [], (child) => child.className)).toEqual([
      'photo',
      'dhead',
      'specs',
      'badges',
      'actions',
      'actions',
      'message collapsed',
      'adv desc',
    ]);
    const button = screen.getByRole('button', { name: 'Ouvrir l’annonce et copier le message' });
    const message = screen.getByRole('textbox', { name: 'Message à envoyer' });
    expect(button.compareDocumentPosition(message) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(sheet?.querySelector('details.desc')?.hasAttribute('open')).toBe(false);
    expect(screen.queryByRole('textbox', { name: 'Note' })).toBeNull();
  });

  it('au retour dans l’application après avoir collé le message, la rafale demande « Message envoyé ? », même après un rafraîchissement', async () => {
    // Given
    browserOpeningListings();
    inBurst();
    const { server } = threeToHandle();
    const state = await renderedApplication(server);
    await waitFor(() => expect(shownName()).toBe('Porsche 911 Carrera S'));

    // When
    await openTheListing();
    document.dispatchEvent(new Event('visibilitychange'));
    act(() => state.refresh.request());
    await waitFor(() => expect(server.requestsTo('GET', '/api/vehicles')).toHaveLength(2));

    // Then
    expect(isShown(confirmation())).toBe(true);
    expect(screen.getByRole('button', { name: 'Oui, envoyé, suivante' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Non, ignorer' })).toBeTruthy();
    expect(shownName()).toBe('Porsche 911 Carrera S');
  });

  it('trois annonces en rafale : « Oui, envoyé, suivante », « Non, ignorer » puis « Passer » mènent au bilan, et « Retour aux annonces » la termine', async () => {
    // Given
    browserOpeningListings();
    inBurst();
    const { server } = threeToHandle();
    const state = await renderedApplication(server);
    await waitFor(() => expect(shownName()).toBe('Porsche 911 Carrera S'));

    // When
    await sentAndNext('Alpine A110 Légende');
    await openTheListing();
    fireEvent.click(screen.getByRole('button', { name: 'Non, ignorer' }));
    await waitFor(() => expect(shownName()).toBe('Ferrari 360 Modena'));
    const thirdProgress = progressText();
    const [skip] = screen.getAllByRole('button', { name: 'Passer' }).filter(isShown);
    fireEvent.click(skip ?? document.body);

    // Then
    const summary = await screen.findByText('Rafale terminée');
    expect(thirdProgress).toBe('3 sur 3');
    expect(summary.parentElement?.querySelector('p')?.textContent).toBe('1 message envoyé, 1 annonce ignorée, 1 passée.');
    expect(server.requests.filter((request) => request.method === 'POST').map((request) => [request.path, request.body])).toEqual([
      ['/api/vehicles/12', { status: 'contacte' }],
      ['/api/vehicles/15', { status: 'ignore' }],
    ]);
    fireEvent.click(screen.getByRole('button', { name: 'Retour aux annonces' }));
    expect(state.burst.value).toBeNull();
    await waitFor(() => expect(window.location.hash).toBe('#/annonces'));
  });

  it('« Annuler » juste après « Oui, envoyé, suivante » revient à la Porsche et ne la compte plus comme envoyée', async () => {
    // Given
    browserOpeningListings();
    inBurst();
    const state = await renderedApplication(threeToHandle().server);
    await waitFor(() => expect(shownName()).toBe('Porsche 911 Carrera S'));
    await sentAndNext('Alpine A110 Légende');

    // When
    fireEvent.click(screen.getByRole('button', { name: 'Annuler' }));

    // Then
    await waitFor(() => expect(shownName()).toBe('Porsche 911 Carrera S'));
    expect(progressText()).toBe('1 sur 3');
    expect(state.burst.value).toMatchObject({ index: 0, sent: 0, ignored: 0, skipped: 0 });
  });

  it('une Alpine contactée entre-temps depuis l’ordinateur sort de la file de la rafale, sans faire sauter la Ferrari qui suit', async () => {
    // Given
    browserOpeningListings();
    inBurst();
    const { server, handledElsewhere } = threeToHandle();
    const state = await renderedApplication(server);
    await waitFor(() => expect(shownName()).toBe('Porsche 911 Carrera S'));
    await sentAndNext('Alpine A110 Légende');

    // When
    handledElsewhere(15, 'contacte');
    act(() => state.refresh.request());

    // Then
    await waitFor(() => expect(shownName()).toBe('Ferrari 360 Modena'));
    expect(progressText()).toBe('2 sur 2');
  });

  it('revenir à la rafale après un détour par la liste reprend à l’Alpine, la suivante, sans la sauter', async () => {
    // Given
    browserOpeningListings();
    inBurst();
    await renderedApplication(threeToHandle().server);
    await waitFor(() => expect(shownName()).toBe('Porsche 911 Carrera S'));
    await sentAndNext('Alpine A110 Légende');
    window.location.hash = '#/annonces';
    await screen.findByRole('link', { name: /Traiter en rafale/ });

    // When
    fireEvent.click(screen.getByRole('link', { name: /Traiter en rafale/ }));

    // Then
    await waitFor(() => expect(shownName()).toBe('Alpine A110 Légende'));
    expect(progressText()).toBe('1 sur 2');
  });

  it('le réseau coupé pendant un rafraîchissement de la rafale laisse la Porsche en cours à l’écran', async () => {
    // Given
    inBurst();
    const { server } = threeToHandle();
    const state = await renderedApplication(server);
    await waitFor(() => expect(shownName()).toBe('Porsche 911 Carrera S'));
    server.on('GET', '/api/vehicles', () => Promise.reject(new TypeError('Failed to fetch')));

    // When
    act(() => state.refresh.request());
    await waitFor(() => expect(server.requestsTo('GET', '/api/vehicles')).toHaveLength(2));

    // Then
    expect(shownName()).toBe('Porsche 911 Carrera S');
    expect(progressText()).toBe('1 sur 3');
    expect(screen.getByRole('status').textContent).toBe('');
  });

  it('une semaine d’alertes larges : les 55 Porsche à traiter, servies en deux pages, entrent toutes dans la rafale', async () => {
    // Given
    inBurst();
    const week = porscheWeekOfAlerts(55);
    const server = serverForSignedInDealer();
    server.on('GET', '/api/vehicles', (request) =>
      request.query.get('cursor') === null
        ? json(200, { vehicles: week.slice(0, 50), nextCursor: 'apres-la-50e' })
        : json(200, { vehicles: week.slice(50), nextCursor: null }),
    );

    // When
    await renderedApplication(server);

    // Then
    await waitFor(() => expect(progressText()).toBe('1 sur 55'));
    expect(server.requestsTo('GET', '/api/vehicles').map((request) => request.url)).toEqual([
      '/api/vehicles?status=nouveau',
      '/api/vehicles?status=nouveau&cursor=apres-la-50e',
    ]);
  });
});
