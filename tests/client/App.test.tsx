import { act, fireEvent, screen, waitFor } from '@testing-library/preact';
import { describe, expect, it, onTestFinished, vi } from 'vitest';
import { startApplication } from '../../client/src/app/startApplication';
import { fakeServer, json, notModified } from './support/fakeServer';
import { renderedApplication, serverForSignedInDealer } from './support/testApplication';
import { overviewWith, porsche911Merignac } from './support/vehicles';

const refusingServiceWorker = (): Pick<ServiceWorkerContainer, 'register' | 'addEventListener' | 'getRegistration'> => ({
  register: () => Promise.reject(new DOMException('The operation is insecure.', 'SecurityError')),
  addEventListener: () => undefined,
  getRegistration: () => Promise.resolve(undefined),
});

const dealerWithListings = () => {
  const server = serverForSignedInDealer();
  server.on('GET', '/api/overview', () => json(200, overviewWith({ nouveau: 3 })));
  server.on('GET', '/api/vehicles', () => json(200, { vehicles: [porsche911Merignac()], nextCursor: null }));
  server.on('GET', '/api/vehicles/12', () => json(200, porsche911Merignac()));
  return server;
};

describe('application', () => {
  it('sans service worker (le navigateur en refuse l’enregistrement), l’application s’ouvre normalement sur la connexion', async () => {
    // Given
    Object.defineProperty(window.navigator, 'serviceWorker', { value: refusingServiceWorker(), configurable: true });
    onTestFinished(() => {
      Reflect.deleteProperty(window.navigator, 'serviceWorker');
    });
    const server = fakeServer();
    server.on('GET', '/api/me', () => json(200, { authenticated: false, needsSetup: false, setupCodeRequired: false }));
    const root = document.body.appendChild(document.createElement('div'));

    // When
    const running = await startApplication({ fetch: server.fetch, window }, root);
    onTestFinished(() => running.stop());

    // Then
    expect(await screen.findByRole('button', { name: 'Se connecter' })).toBeTruthy();
  });

  it('le badge des annonces à traiter apparaît dans la barre du haut et dans la barre d’onglets, et « Annonces » reste l’onglet actif sur la fiche ouverte depuis la liste', async () => {
    // Given
    const server = dealerWithListings();
    const state = await renderedApplication(server);
    await waitFor(() => expect(state.overview.data.value).not.toBeNull());

    // When
    window.location.hash = '#/annonce/12';
    window.dispatchEvent(new HashChangeEvent('hashchange'));

    // Then
    const badges = (): readonly (string | undefined)[] =>
      screen
        .getAllByRole('link', { name: /Annonces/ })
        .filter((link) => link.getAttribute('href') === '#/annonces' && link.getAttribute('aria-current') === 'page')
        .map((link) => link.querySelector('.badge.count')?.textContent);
    await waitFor(() => expect(badges()).toEqual(['3', '3']));
  });

  it('changer d’écran ramène en haut de page ; le rafraîchissement de la liste toutes les 60 s garde la position de lecture', async () => {
    // Given
    const server = dealerWithListings();
    const state = await renderedApplication(server);
    const scrolled = vi.mocked(window.scrollTo);

    // When
    act(() => state.refresh.request());
    const afterRefresh = scrolled.mock.calls.length;
    window.location.hash = '#/reglages';
    window.dispatchEvent(new HashChangeEvent('hashchange'));

    // Then
    expect(afterRefresh).toBe(0);
    expect(scrolled).toHaveBeenCalledWith({ top: 0 });
    expect(await screen.findByRole('heading', { name: 'Réglages' })).toBeTruthy();
  });

  it('au retour dans l’application après avoir collé le message sur le site, l’accueil et la liste sont redemandés avec leur ETag, sans rien retransférer', async () => {
    // Given
    const server = serverForSignedInDealer();
    server.on('GET', '/api/overview', (request) =>
      request.headers.get('if-none-match') === 'W/"accueil-1"'
        ? notModified()
        : json(200, overviewWith({ nouveau: 1 }), { etag: 'W/"accueil-1"' }),
    );
    server.on('GET', '/api/vehicles', (request) =>
      request.headers.get('if-none-match') === 'W/"liste-1"'
        ? notModified()
        : json(200, { vehicles: [porsche911Merignac()], nextCursor: null }, { etag: 'W/"liste-1"' }),
    );
    vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined);
    const root = document.body.appendChild(document.createElement('div'));
    const running = await startApplication({ fetch: server.fetch, window }, root);
    onTestFinished(() => running.stop());
    await waitFor(() => expect(running.state.vehicles.current.value.loaded).toBe(true));
    const shown = running.state.vehicles.current.value;

    // When
    document.dispatchEvent(new Event('visibilitychange'));
    await waitFor(() => expect(server.requestsTo('GET', '/api/vehicles')).toHaveLength(2));

    // Then
    expect(server.requestsTo('GET', '/api/vehicles')[1]?.headers.get('if-none-match')).toBe('W/"liste-1"');
    await waitFor(() => expect(server.requestsTo('GET', '/api/overview')[1]?.headers.get('if-none-match')).toBe('W/"accueil-1"'));
    expect(running.state.vehicles.current.value).toBe(shown);
    expect(document.visibilityState).toBe('visible');
  });

  it('au premier lancement sans code d’installation exigé, l’écran propose seulement de choisir le mot de passe, puis ouvre les annonces', async () => {
    // Given
    const server = fakeServer();
    const answers = [
      { authenticated: false, needsSetup: true, setupCodeRequired: false },
      { authenticated: true, needsSetup: false, setupCodeRequired: false },
    ];
    server.on('GET', '/api/me', () => json(200, answers.shift()));
    server.on('POST', '/api/setup', () => json(200, { ok: true }));
    server.on('GET', '/api/overview', () => json(200, overviewWith({ nouveau: 0 })));
    server.on('GET', '/api/vehicles', () => json(200, { vehicles: [], nextCursor: null }));
    await renderedApplication(server);
    const password = await screen.findByLabelText('Nouveau mot de passe (8 caractères minimum)');
    const invitation = screen.getByText('Première connexion. Choisissez le mot de passe qui servira ensuite à ouvrir l’application.');

    // When
    fireEvent.input(password, { target: { value: 'concession-2026' } });
    fireEvent.click(screen.getByRole('button', { name: 'Commencer' }));

    // Then
    expect(await screen.findByRole('heading', { name: 'Rien à traiter pour le moment' })).toBeTruthy();
    expect(invitation.textContent).toBe('Première connexion. Choisissez le mot de passe qui servira ensuite à ouvrir l’application.');
    expect(screen.queryByLabelText('Code de première connexion')).toBeNull();
    expect(server.requestsTo('POST', '/api/setup')[0]?.body).toEqual({ setupCode: '', password: 'concession-2026' });
    expect(window.location.hash).toBe('#/annonces');
  });

  it('un mot de passe erroné affiche, comme avant la refonte, « Connexion expirée, reconnectez-vous. » plutôt que la phrase du serveur', async () => {
    // Given
    const server = fakeServer();
    server.on('GET', '/api/me', () => json(200, { authenticated: false, needsSetup: false, setupCodeRequired: false }));
    server.on('POST', '/api/login', () => json(401, { error: 'Mot de passe incorrect.' }));
    await renderedApplication(server);
    const password = await screen.findByLabelText('Mot de passe');

    // When
    fireEvent.input(password, { target: { value: 'mauvais-mot' } });
    fireEvent.click(screen.getByRole('button', { name: 'Se connecter' }));

    // Then
    expect(await screen.findByText('Connexion expirée, reconnectez-vous.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Se connecter' })).toBeTruthy();
  });
});
