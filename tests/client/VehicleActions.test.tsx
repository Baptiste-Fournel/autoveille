import { act, fireEvent, screen, waitFor, within } from '@testing-library/preact';
import { describe, expect, it } from 'vitest';
import type { OverviewResponse, VehicleDto, VehicleUpdateRequest } from '../../src/shared/api';
import { type FakeServer, json, type RecordedRequest } from './support/fakeServer';
import { heldAnswer } from './support/heldAnswer';
import { browserOpeningListings, isShown } from './support/listingTab';
import { serverWithLists } from './support/listsServer';
import { renderedApplication } from './support/testApplication';
import { alpineA110Pessac, overviewWith, porsche911Merignac } from './support/vehicles';

const PORSCHE_MESSAGE = 'Bonjour, votre Porsche 911 Carrera S de 2015 m’intéresse. Concession Autos du Sud-Ouest, 06 12 34 56 78.';

const PORSCHE_URL = 'https://www.leboncoin.fr/ad/voitures/2811001234';

const changeIn = (request: RecordedRequest): VehicleUpdateRequest =>
  typeof request.body === 'object' && request.body !== null ? request.body : {};

const answeredAsServer = (vehicle: VehicleDto) => (request: RecordedRequest) => {
  const change = changeIn(request);
  const status = change.doNotContact === true ? 'ignore' : (change.status ?? vehicle.status);
  return json(200, {
    ...vehicle,
    status,
    doNotContact: change.doNotContact ?? vehicle.doNotContact,
    contactedAt: status === 'contacte' ? '2026-10-16T09:00:00.000Z' : null,
  });
};

const porscheToHandle = (): FakeServer => {
  const server = serverWithLists({ nouveau: [porsche911Merignac()] });
  server.on('POST', '/api/vehicles/12', answeredAsServer(porsche911Merignac()));
  return server;
};

const confirmation = (): HTMLElement => {
  const box = screen.getByText('Message envoyé au vendeur ?').closest('.confirm');
  if (!(box instanceof HTMLElement)) {
    throw new Error('Pas de confirmation');
  }
  return box;
};

const cardOf = (vehicle: VehicleDto): HTMLElement => {
  const card = document.getElementById(`v-${vehicle.id}`);
  if (card === null) {
    throw new Error(`Pas de carte pour ${vehicle.name}`);
  }
  return card;
};

const shownCards = (): readonly (string | null)[] => [...document.querySelectorAll('article.listing h3')].map((title) => title.textContent);

const weekLine = (): string | null | undefined => document.querySelector('.headline .week')?.textContent;

const caddyWhileTheServerRestarts = (): Response =>
  new Response('<html><body>502 Bad Gateway</body></html>', { status: 502, headers: { 'content-type': 'text/html' } });

const openTheListing = async (): Promise<void> => {
  fireEvent.click(await screen.findByRole('button', { name: 'Ouvrir l’annonce et copier le message' }));
  await waitFor(() => expect(screen.getByRole('status').textContent).not.toBe(''));
};

describe('boutons d’une annonce', () => {
  it('le message est copié avant l’ouverture de l’annonce, et la confirmation invite à le coller', async () => {
    // Given
    const steps = browserOpeningListings();
    await renderedApplication(porscheToHandle());

    // When
    await openTheListing();

    // Then
    expect(steps).toEqual([`copie : ${PORSCHE_MESSAGE}`, `ouverture : ${PORSCHE_URL}`]);
    expect(screen.getByRole('status').textContent).toBe('Message copié : collez-le dans le formulaire de contact de l’annonce.');
    expect(isShown(confirmation())).toBe(true);
  });

  it('la question « Message envoyé au vendeur ? » est encore là après le rafraîchissement qui suit le retour depuis l’annonce', async () => {
    // Given
    browserOpeningListings();
    const server = porscheToHandle();
    const state = await renderedApplication(server);
    await openTheListing();
    const before = state.vehicles.current.value;

    // When
    act(() => state.refresh.request());
    await waitFor(() => expect(state.vehicles.current.value).not.toBe(before));

    // Then
    expect(server.requestsTo('GET', '/api/vehicles')).toHaveLength(2);
    expect(isShown(confirmation())).toBe(true);
    expect(screen.getByRole('button', { name: 'Oui, envoyé' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Pas maintenant' })).toBeTruthy();
  });

  it('« Pas maintenant » range la question, qui ne revient pas au rafraîchissement suivant', async () => {
    // Given
    browserOpeningListings();
    const state = await renderedApplication(porscheToHandle());
    await openTheListing();

    // When
    fireEvent.click(screen.getByRole('button', { name: 'Pas maintenant' }));
    act(() => state.refresh.request());

    // Then
    expect(isShown(confirmation())).toBe(false);
    expect(state.pendingConfirmation.value).toBeNull();
  });

  it('un onglet bloqué par le navigateur affiche « Le navigateur a bloqué l’ouverture de l’annonce… » en erreur', async () => {
    // Given
    browserOpeningListings({ blocked: true });
    await renderedApplication(porscheToHandle());

    // When
    await openTheListing();

    // Then
    const toast = screen.getByRole('status');
    expect(toast.textContent).toBe('Le navigateur a bloqué l’ouverture de l’annonce : ouvrez-la avec le lien « Voir l’annonce ».');
    expect(toast.className).toBe('show error');
  });

  it('un onglet dont opener est en lecture seule s’ouvre quand même et le message est copié', async () => {
    // Given
    const steps = browserOpeningListings({ openerLocked: true });
    await renderedApplication(porscheToHandle());

    // When
    await openTheListing();

    // Then
    expect(steps).toEqual([`copie : ${PORSCHE_MESSAGE}`, `ouverture : ${PORSCHE_URL}`, 'opener en lecture seule']);
    expect(screen.getByRole('status').textContent).toBe('Message copié : collez-le dans le formulaire de contact de l’annonce.');
    expect(isShown(confirmation())).toBe(true);
  });

  it('un téléphone qui refuse l’accès au presse-papiers ouvre quand même l’annonce et invite à copier le message à la main', async () => {
    // Given
    const steps = browserOpeningListings({ copyRefused: true });
    await renderedApplication(porscheToHandle());

    // When
    await openTheListing();

    // Then
    expect(steps).toEqual([`copie : ${PORSCHE_MESSAGE}`, `ouverture : ${PORSCHE_URL}`, 'copie de secours : copy']);
    expect(screen.getByRole('status').textContent).toBe('Annonce ouverte. Copiez le message à la main.');
  });

  it('« Annuler » dans les six secondes remet à traiter la Porsche passée par erreur en « ne plus contacter »', async () => {
    // Given
    const server = porscheToHandle();
    await renderedApplication(server);
    fireEvent.click(await screen.findByRole('button', { name: 'Ne plus contacter' }));
    await waitFor(() => expect(document.querySelector('article.listing')).toBeNull());
    expect(screen.getByRole('status').firstChild?.textContent).toBe('Vendeur ajouté à la liste « ne plus contacter »');

    // When
    fireEvent.click(screen.getByRole('button', { name: 'Annuler' }));

    // Then
    await waitFor(() => expect(screen.getByRole('status').textContent).toBe('Annulé'));
    expect(document.querySelectorAll('article.listing')).toHaveLength(1);
    expect(server.requestsTo('POST', '/api/vehicles/12').map((request) => request.body)).toEqual([
      { doNotContact: true },
      { status: 'nouveau', doNotContact: false },
    ]);
  });

  it('« Ignorer » puis « Annuler » sur la Porsche dont le prix est passé de 92 900 à 89 900 € : sa carte dit toujours « prix », comme les cartes qu’on n’a pas touchées', async () => {
    // Given
    const leboncoin = {
      id: 40,
      site: 'leboncoin',
      siteLabel: 'Leboncoin',
      url: PORSCHE_URL,
      title: 'Porsche 911 Carrera S 2015 42 000 km 89 900 €',
      price: 89900,
      firstSeenAt: '2026-10-10T07:45:00.000Z',
      lastSeenAt: '2026-10-15T08:04:00.000Z',
      priceHistory: [],
    };
    const listed = porsche911Merignac({ priceDropped: true, listings: [leboncoin] });
    const sheet = porsche911Merignac({
      priceDropped: true,
      listings: [
        {
          ...leboncoin,
          priceHistory: [
            { price: 92900, seen_at: '2026-10-10T07:45:00.000Z' },
            { price: 89900, seen_at: '2026-10-15T08:04:00.000Z' },
          ],
        },
      ],
      events: [{ id: 7, vehicle_id: 12, type: 'prix_baisse', detail: '92 900 € → 89 900 €', at: '2026-10-15T08:04:00.000Z' }],
    });
    const server = serverWithLists({ nouveau: [listed] });
    server.on('POST', '/api/vehicles/12', answeredAsServer(sheet));
    await renderedApplication(server);
    const before = within(await waitFor(() => cardOf(listed))).getByText(/^prix/).textContent;

    // When
    fireEvent.click(within(cardOf(listed)).getByRole('button', { name: 'Ignorer' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Annuler' })).toBeTruthy());
    fireEvent.click(screen.getByRole('button', { name: 'Annuler' }));
    await waitFor(() => expect(screen.getByRole('status').textContent).toBe('Annulé'));

    // Then
    expect(before).toBe('prix');
    expect(within(cardOf(listed)).getByText(/^prix/).textContent).toBe('prix');
  });

  it('la Porsche passée dans « Contactées » par erreur : « Pas encore contactée » la remet à traiter', async () => {
    // Given
    const contacted = porsche911Merignac({ status: 'contacte', contactedAt: '2026-10-15T09:10:00.000Z' });
    const server = serverWithLists({ contacte: [contacted] });
    server.on('POST', '/api/vehicles/12', answeredAsServer(contacted));
    await renderedApplication(server);
    fireEvent.click(await screen.findByRole('button', { name: /^Contactées/ }));
    const undoContact = await screen.findByRole('button', { name: 'Pas encore contactée' });

    // When
    fireEvent.click(undoContact);

    // Then
    expect(undoContact.getAttribute('title')).toBe('Si vous l’avez marquée contactée par erreur');
    await waitFor(() => expect(document.querySelector('article.listing')).toBeNull());
    expect(screen.getByRole('status').firstChild?.textContent).toBe('Remise à traiter');
    expect(server.requestsTo('POST', '/api/vehicles/12').map((request) => request.body)).toEqual([{ status: 'nouveau' }]);
  });

  it('« Ignorer » sur la Porsche pendant le redémarrage du serveur : la carte s’en va aussitôt, puis revient en tête de liste avec « Erreur 502 »', async () => {
    // Given
    const server = serverWithLists({ nouveau: [porsche911Merignac(), alpineA110Pessac()] }, { overview: overviewWith({ nouveau: 2 }) });
    const restarting = heldAnswer();
    server.on('POST', '/api/vehicles/12', restarting.answer);
    await renderedApplication(server);
    const porsche = within(await waitFor(() => cardOf(porsche911Merignac())));

    // When
    fireEvent.click(porsche.getByRole('button', { name: 'Ignorer' }));
    const whileTheServerRestarts = { cards: shownCards(), title: screen.getByRole('heading', { level: 1 }).textContent };
    await waitFor(() => expect(server.requestsTo('POST', '/api/vehicles/12')).toHaveLength(1));
    restarting.release(caddyWhileTheServerRestarts());

    // Then
    expect(whileTheServerRestarts).toEqual({ cards: ['Alpine A110 Légende'], title: '1 annonce à traiter' });
    await waitFor(() => expect(shownCards()).toEqual(['Porsche 911 Carrera S', 'Alpine A110 Légende']));
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('2 annonces à traiter');
    expect(screen.getByRole('status').textContent).toBe('Erreur 502');
    expect(screen.getByRole('status').className).toBe('show error');
  });

  it('« Pas encore contactée » sur la Porsche contactée par erreur la retire aussi de la ligne des sept derniers jours', async () => {
    // Given
    const contacted = porsche911Merignac({ status: 'contacte', contactedAt: '2026-10-15T09:10:00.000Z' });
    const server = serverWithLists({ contacte: [contacted] });
    const weekWith = (contactedThisWeek: number): OverviewResponse => ({
      ...overviewWith({ nouveau: 3 - contactedThisWeek, contacte: contactedThisWeek }),
      week: { received: 4, contacted: contactedThisWeek, replied: 0 },
    });
    const overviews = [weekWith(1)];
    server.on('GET', '/api/overview', () => json(200, overviews[overviews.length - 1]));
    server.on('POST', '/api/vehicles/12', (request) => {
      overviews.push(weekWith(0));
      return answeredAsServer(contacted)(request);
    });
    await renderedApplication(server);
    fireEvent.click(await screen.findByRole('button', { name: /^Contactées/ }));
    const undoContact = await screen.findByRole('button', { name: 'Pas encore contactée' });
    const before = weekLine();

    // When
    fireEvent.click(undoContact);

    // Then
    expect(before).toBe('7 derniers jours : 4 annonces retenues, 1 contactée, 0 réponse.');
    await waitFor(() => expect(weekLine()).toBe('7 derniers jours : 4 annonces retenues, 0 contactée, 0 réponse.'));
  });
});
