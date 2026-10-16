import { act, fireEvent, screen, waitFor } from '@testing-library/preact';
import { describe, expect, it, onTestFinished, vi } from 'vitest';
import type { FakeServer } from './support/fakeServer';
import { json, notModified } from './support/fakeServer';
import { serverWithLists } from './support/listsServer';
import { renderedApplication } from './support/testApplication';
import { porsche911Merignac } from './support/vehicles';

const PORSCHE_SHEET_ETAG = 'W/"3f1-porsche-12"';

const REMOVAL_QUESTION = 'Supprimer cette annonce de l’application ? Elle reviendra si un site la renvoie.';

const misreadAudi = porsche911Merignac({
  id: 31,
  name: 'Audi',
  title: 'Audi Autres - Audi 3.0',
  make: 'Audi',
  model: null,
  year: null,
  km: null,
  price: 3000,
  specialReason: null,
  url: 'https://www.paruvendu.fr/a/voiture-occasion/audi/autres/1253489765',
  site: 'paruvendu',
  siteLabel: 'ParuVendu',
});

const answeringConfirm = (answer: boolean): string[] => {
  const questions: string[] = [];
  const confirm = vi.spyOn(window, 'confirm').mockImplementation((question) => {
    questions.push(String(question));
    return answer;
  });
  onTestFinished(() => confirm.mockRestore());
  return questions;
};

const audiSheetServer = (): FakeServer => {
  window.history.replaceState(null, '', '/#/annonce/31');
  const server = serverWithLists({ nouveau: [] });
  server.on('GET', '/api/vehicles/31', () => json(200, misreadAudi));
  server.on('DELETE', '/api/vehicles/31', () => json(200, { ok: true }));
  return server;
};

describe('écran de la fiche', () => {
  it('une fiche ouverte depuis une ancienne notification, dont l’annonce a été supprimée entre-temps, affiche « Annonce introuvable »', async () => {
    // Given
    window.history.replaceState(null, '', '/#/annonce/12');
    const server = serverWithLists({});
    server.on('GET', '/api/vehicles/12', () => json(404, { error: 'Annonce inconnue.' }));

    // When
    await renderedApplication(server);

    // Then
    const missing = await screen.findByText('Annonce introuvable');
    expect(missing.closest('.empty')?.textContent).toBe('Annonce introuvableRetour aux annonces');
    expect(screen.getByRole('link', { name: 'Retour aux annonces' }).getAttribute('href')).toBe('#/annonces');
  });

  it('une adresse de fiche abîmée en la recopiant, #/annonce/abc, affiche « Annonce introuvable » et le retour aux annonces, comme avant la refonte', async () => {
    // Given
    window.history.replaceState(null, '', '/#/annonce/abc');
    const server = serverWithLists({});
    server.on('GET', '/api/vehicles/NaN', () => json(404, { error: 'Annonce inconnue.' }));

    // When
    await renderedApplication(server);

    // Then
    const missing = await screen.findByText('Annonce introuvable');
    expect(missing.closest('.empty')?.textContent).toBe('Annonce introuvableRetour aux annonces');
    expect(screen.getByRole('link', { name: 'Retour aux annonces' }).getAttribute('href')).toBe('#/annonces');
  });

  it('la fiche de la Porsche restée ouverte : le rafraîchissement de la minute la redemande avec son ETag, le serveur répond qu’elle n’a pas changé et rien n’est retransféré', async () => {
    // Given
    window.history.replaceState(null, '', '/#/annonce/12');
    const server = serverWithLists({});
    server.on('GET', '/api/vehicles/12', (request) =>
      request.headers.get('if-none-match') === PORSCHE_SHEET_ETAG
        ? notModified()
        : json(200, porsche911Merignac(), { etag: PORSCHE_SHEET_ETAG }),
    );
    const state = await renderedApplication(server);
    await screen.findByRole('heading', { name: 'Porsche 911 Carrera S' });

    // When
    act(() => state.refresh.request());
    await waitFor(() => expect(server.requestsTo('GET', '/api/vehicles/12')).toHaveLength(2));

    // Then
    expect(server.requestsTo('GET', '/api/vehicles/12').map((request) => request.headers.get('if-none-match'))).toEqual([
      null,
      PORSCHE_SHEET_ETAG,
    ]);
    expect(screen.getByRole('heading', { name: 'Porsche 911 Carrera S' })).toBeTruthy();
  });

  it('supprimer depuis sa fiche une Audi mal lue la retire de l’application après confirmation, et la liste revient', async () => {
    // Given
    const questions = answeringConfirm(true);
    const server = audiSheetServer();
    await renderedApplication(server);

    // When
    fireEvent.click(await screen.findByRole('button', { name: 'Supprimer cette annonce' }));

    // Then
    await waitFor(() => expect(window.location.hash).toBe('#/annonces'));
    expect(questions).toEqual([REMOVAL_QUESTION]);
    expect(server.requestsTo('DELETE', '/api/vehicles/31')).toHaveLength(1);
    expect(screen.getByRole('status').textContent).toBe('Annonce supprimée');
  });

  it('renoncer à supprimer l’Audi laisse sa fiche en place, sans rien demander au serveur', async () => {
    // Given
    answeringConfirm(false);
    const server = audiSheetServer();
    await renderedApplication(server);

    // When
    fireEvent.click(await screen.findByRole('button', { name: 'Supprimer cette annonce' }));

    // Then
    expect(server.requestsTo('DELETE', '/api/vehicles/31')).toHaveLength(0);
    expect(window.location.hash).toBe('#/annonce/31');
    expect(screen.getByRole('heading', { level: 2, name: 'Audi' })).toBeTruthy();
  });
});
