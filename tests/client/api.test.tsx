import { screen } from '@testing-library/preact';
import { describe, expect, it } from 'vitest';
import { ApiError } from '../../client/src/api/ApiError';
import { createApiClient } from '../../client/src/api/client';
import { createHttp } from '../../client/src/api/http';
import { fakeServer, json } from './support/fakeServer';
import { renderedApplication, serverForSignedInDealer } from './support/testApplication';

const failureOf = async (promise: Promise<unknown>): Promise<ApiError> => {
  try {
    await promise;
  } catch (error) {
    if (error instanceof ApiError) {
      return error;
    }
    throw error;
  }
  throw new Error('la requête devait échouer');
};

describe('client de l’API', () => {
  it('une réponse d’erreur sans corps JSON (le proxy renvoie une page 502) s’affiche « Erreur 502 »', async () => {
    // Given
    const server = fakeServer();
    server.on(
      'GET',
      '/api/sources',
      () => new Response('<html>Bad Gateway</html>', { status: 502, headers: { 'content-type': 'text/html' } }),
    );
    const api = createApiClient(createHttp({ fetch: server.fetch, onUnauthorized: () => undefined }));

    // When
    const failure = await failureOf(api.sources());

    // Then
    expect(failure.message).toBe('Erreur 502');
    expect(failure.status).toBe(502);
  });

  it('une annonce supprimée entre-temps : la phrase du serveur « Annonce inconnue. » est rendue telle quelle', async () => {
    // Given
    const server = fakeServer();
    server.on('GET', '/api/vehicles/12', () => json(404, { error: 'Annonce inconnue.' }));
    const api = createApiClient(createHttp({ fetch: server.fetch, onUnauthorized: () => undefined }));

    // When
    const failure = await failureOf(api.vehicleIfChanged(12, null));

    // Then
    expect(failure.message).toBe('Annonce inconnue.');
  });

  it('la note « Rappeler samedi matin » enregistrée sur la Porsche part avec le cookie de session de l’application, en JSON', async () => {
    // Given
    const server = fakeServer();
    const sent: RequestInit[] = [];
    const recordingFetch: typeof fetch = (input, init) => {
      sent.push(init ?? {});
      return server.fetch(input, init);
    };
    server.on('POST', '/api/vehicles/12', () => json(200, {}));
    const api = createApiClient(createHttp({ fetch: recordingFetch, onUnauthorized: () => undefined }));

    // When
    await api.updateVehicle(12, { note: 'Rappeler samedi matin' });

    // Then
    expect(sent[0]?.credentials).toBe('same-origin');
    expect(new Headers(sent[0]?.headers).get('content-type')).toBe('application/json');
    expect(server.requestsTo('POST', '/api/vehicles/12')[0]?.body).toEqual({ note: 'Rappeler samedi matin' });
  });

  it('une session expirée pendant la consultation des annonces ramène à l’écran de connexion', async () => {
    // Given
    const server = serverForSignedInDealer();
    server.on('GET', '/api/overview', () => json(401, { error: 'non connecté' }));
    server.on('GET', '/api/vehicles', () => json(401, { error: 'non connecté' }));

    // When
    await renderedApplication(server);

    // Then
    expect(await screen.findByRole('button', { name: 'Se connecter' })).toBeTruthy();
    expect(screen.getByLabelText('Mot de passe')).toBeTruthy();
  });
});
