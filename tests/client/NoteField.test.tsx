import { fireEvent, screen, waitFor } from '@testing-library/preact';
import { describe, expect, it } from 'vitest';
import type { VehicleDto, VehicleUpdateRequest } from '../../src/shared/api';
import { type FakeServer, json, notModified } from './support/fakeServer';
import { serverWithLists } from './support/listsServer';
import { renderedApplication } from './support/testApplication';
import { porsche911Merignac } from './support/vehicles';

const NOTE = 'Rappeler samedi matin, il descend à 87 000 € pour un paiement comptant.';

const LIST_ETAG = 'W/"porsche-rappeler-lundi"';

const porscheKeptByServer = (initial: VehicleDto): FakeServer => {
  let kept = initial;
  const server = serverWithLists({ nouveau: [] });
  server.on('GET', '/api/vehicles', () => json(200, { vehicles: [kept], nextCursor: null }));
  server.on('GET', '/api/vehicles/12', () => json(200, kept));
  server.on('POST', '/api/vehicles/12', (request) => {
    const change: VehicleUpdateRequest = typeof request.body === 'object' && request.body !== null ? request.body : {};
    kept = { ...kept, note: change.note ?? kept.note };
    return json(200, kept);
  });
  return server;
};

describe('note sur une annonce', () => {
  it('une note saisie sur la fiche de la Porsche est enregistrée en quittant le champ et apparaît sur sa carte', async () => {
    // Given
    window.history.replaceState(null, '', '/#/annonce/12');
    const server = porscheKeptByServer(porsche911Merignac());
    await renderedApplication(server);
    const note = await screen.findByRole('textbox', { name: 'Note' });

    // When
    fireEvent.input(note, { target: { value: NOTE } });
    fireEvent.blur(note);
    await waitFor(() => expect(screen.getByRole('status').textContent).toBe('Note enregistrée'));
    fireEvent.click(screen.getByRole('link', { name: '← Annonces' }));

    // Then
    await waitFor(() => expect(document.querySelector('article.listing .vnote')?.textContent).toBe(NOTE));
    expect(server.requestsTo('POST', '/api/vehicles/12').map((request) => request.body)).toEqual([{ note: NOTE }]);
  });

  it('vider la note de la Porsche une fois le rendez-vous passé dit « Note effacée »', async () => {
    // Given
    window.history.replaceState(null, '', '/#/annonce/12');
    const server = porscheKeptByServer(porsche911Merignac({ note: NOTE }));
    await renderedApplication(server);
    const note = await screen.findByRole('textbox', { name: 'Note' });

    // When
    fireEvent.input(note, { target: { value: '' } });
    fireEvent.blur(note);

    // Then
    await waitFor(() => expect(screen.getByRole('status').textContent).toBe('Note effacée'));
    expect(server.requestsTo('POST', '/api/vehicles/12').map((request) => request.body)).toEqual([{ note: '' }]);
  });

  it('une note tapée sur la fiche dans un parking souterrain, sans réseau, n’est pas gardée : la carte remontre la note d’avant et la raison s’affiche', async () => {
    // Given
    const porsche = porsche911Merignac({ note: 'Rappeler lundi' });
    const server = serverWithLists({ nouveau: [] });
    server.on('GET', '/api/vehicles', (request) =>
      request.headers.get('if-none-match') === LIST_ETAG
        ? notModified()
        : json(200, { vehicles: [porsche], nextCursor: null }, { etag: LIST_ETAG }),
    );
    server.on('GET', '/api/vehicles/12', () => json(200, porsche));
    server.on('POST', '/api/vehicles/12', () => Promise.reject(new TypeError('Load failed')));
    await renderedApplication(server);
    const [, titleLink] = await screen.findAllByRole('link', { name: 'Voir la fiche : Porsche 911 Carrera S' });
    fireEvent.click(titleLink ?? document.body);
    const note = await screen.findByRole('textbox', { name: 'Note' });

    // When
    fireEvent.input(note, { target: { value: NOTE } });
    fireEvent.blur(note);
    await waitFor(() => expect(screen.getByRole('status').textContent).toBe('Load failed'));
    fireEvent.click(screen.getByRole('link', { name: '← Annonces' }));

    // Then
    await waitFor(() => expect(server.requestsTo('GET', '/api/vehicles')).toHaveLength(2));
    expect(server.requestsTo('GET', '/api/vehicles')[1]?.headers.get('if-none-match')).toBe(LIST_ETAG);
    expect(document.querySelector('article.listing .vnote')?.textContent).toBe('Rappeler lundi');
    expect(screen.getByRole('status').className).toBe('show error');
  });
});
