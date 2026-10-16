import { fireEvent, screen, waitFor } from '@testing-library/preact';
import { describe, expect, it } from 'vitest';
import type { MeResponse } from '../../src/shared/api';
import { fakeServer, json } from './support/fakeServer';
import { renderedApplication } from './support/testApplication';
import { overviewWith } from './support/vehicles';

const FIRST_VISIT_WITH_CODE: MeResponse = { authenticated: false, needsSetup: true, setupCodeRequired: true };

const SIGNED_OUT: MeResponse = { authenticated: false, needsSetup: false, setupCodeRequired: false };

const SIGNED_IN: MeResponse = { authenticated: true, needsSetup: false, setupCodeRequired: false };

const serverAnsweringMe = (...answers: readonly MeResponse[]) => {
  const server = fakeServer();
  const pending = [...answers];
  server.on('GET', '/api/me', () => json(200, pending.length > 1 ? pending.shift() : pending[0]));
  server.on('GET', '/api/overview', () => json(200, overviewWith({ nouveau: 0 })));
  server.on('GET', '/api/vehicles', () => json(200, { vehicles: [], nextCursor: null }));
  return server;
};

const shellShown = async (): Promise<void> => {
  expect(await screen.findAllByRole('link', { name: 'Sites' })).toHaveLength(2);
};

describe('écran de connexion', () => {
  it('à la première ouverture depuis le téléphone, le concessionnaire saisit le code fourni à l’installation et choisit son mot de passe : les annonces s’ouvrent', async () => {
    // Given
    const server = serverAnsweringMe(FIRST_VISIT_WITH_CODE, SIGNED_IN);
    server.on('POST', '/api/setup', () => json(200, { ok: true }));
    await renderedApplication(server);
    expect(
      await screen.findByText(
        'Première connexion. Saisissez le code fourni à l’installation, puis choisissez le mot de passe qui servira ensuite à ouvrir l’application.',
      ),
    ).toBeTruthy();

    // When
    fireEvent.input(screen.getByLabelText('Code de première connexion'), { target: { value: 'K7Q2-9XPM' } });
    fireEvent.input(screen.getByLabelText('Nouveau mot de passe (8 caractères minimum)'), { target: { value: 'concession-2026' } });
    fireEvent.click(screen.getByRole('button', { name: 'Commencer' }));

    // Then
    await shellShown();
    expect(server.requestsTo('POST', '/api/setup')[0]?.body).toEqual({ setupCode: 'K7Q2-9XPM', password: 'concession-2026' });
    expect(window.location.hash).toBe('#/annonces');
  });

  it('un code de première connexion faux est refusé avec la phrase du serveur, et l’écran de première connexion reste affiché', async () => {
    // Given
    const server = serverAnsweringMe(FIRST_VISIT_WITH_CODE);
    server.on('POST', '/api/setup', () => json(403, { error: 'Code de première connexion incorrect.' }));
    await renderedApplication(server);
    fireEvent.input(await screen.findByLabelText('Code de première connexion'), { target: { value: 'K7Q2-9XPN' } });
    fireEvent.input(screen.getByLabelText('Nouveau mot de passe (8 caractères minimum)'), { target: { value: 'concession-2026' } });

    // When
    fireEvent.click(screen.getByRole('button', { name: 'Commencer' }));

    // Then
    expect(await screen.findByText('Code de première connexion incorrect.')).toBeTruthy();
    expect(document.getElementById('toast')?.className).toBe('show error');
    expect(screen.getByLabelText<HTMLInputElement>('Code de première connexion').value).toBe('K7Q2-9XPN');
  });

  it('sur un nouvel appareil, le bon mot de passe ouvre les annonces', async () => {
    // Given
    const server = serverAnsweringMe(SIGNED_OUT, SIGNED_IN);
    server.on('POST', '/api/login', () => json(200, { ok: true }));
    await renderedApplication(server);
    const password = await screen.findByLabelText<HTMLInputElement>('Mot de passe');
    expect(screen.getByText('Les nouvelles annonces qui vous intéressent, avec le message prêt à envoyer.')).toBeTruthy();

    // When
    fireEvent.input(password, { target: { value: 'concession-2026' } });
    fireEvent.click(screen.getByRole('button', { name: 'Se connecter' }));

    // Then
    await shellShown();
    expect(server.requestsTo('POST', '/api/login')[0]?.body).toEqual({ password: 'concession-2026' });
    expect(password.autocomplete).toBe('current-password');
    await waitFor(() => expect(window.location.hash).toBe('#/annonces'));
  });

  it('un mot de passe refusé disparaît du champ, comme avant la refonte : l’écran de connexion est refait à neuf pour l’essai suivant', async () => {
    // Given
    const server = serverAnsweringMe(SIGNED_OUT);
    server.on('POST', '/api/login', () => json(401, { error: 'Mot de passe incorrect.' }));
    await renderedApplication(server);
    fireEvent.input(await screen.findByLabelText('Mot de passe'), { target: { value: 'concession-2025' } });

    // When
    fireEvent.click(screen.getByRole('button', { name: 'Se connecter' }));

    // Then
    expect(await screen.findByText('Connexion expirée, reconnectez-vous.')).toBeTruthy();
    expect(screen.getByLabelText<HTMLInputElement>('Mot de passe').value).toBe('');
  });

  it('après huit mots de passe faux, le serveur fait patienter : sa phrase s’affiche et l’écran de connexion reste là', async () => {
    // Given
    const server = serverAnsweringMe(SIGNED_OUT);
    server.on('POST', '/api/login', () => json(429, { error: 'Trop d’essais, réessayez dans dix minutes.' }));
    await renderedApplication(server);
    fireEvent.input(await screen.findByLabelText('Mot de passe'), { target: { value: 'concession-2025' } });

    // When
    fireEvent.click(screen.getByRole('button', { name: 'Se connecter' }));

    // Then
    expect(await screen.findByText('Trop d’essais, réessayez dans dix minutes.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Se connecter' })).toBeTruthy();
    expect(screen.getByLabelText<HTMLInputElement>('Mot de passe').value).toBe('concession-2025');
  });
});
