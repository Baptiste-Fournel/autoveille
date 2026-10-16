import { fireEvent, screen, waitFor } from '@testing-library/preact';
import { describe, expect, it } from 'vitest';
import type { VehicleDto, VehicleUpdateRequest } from '../../src/shared/api';
import { type FakeServer, json } from './support/fakeServer';
import { itIsThursdayMorning, serverWithLists } from './support/listsServer';
import { renderedApplication } from './support/testApplication';
import { ferrari360Langon, overviewWith, porsche911Merignac } from './support/vehicles';

const openedSheetOf = (id: number): void => {
  window.history.replaceState(null, '', `/#/annonce/${id}`);
};

const sheet = (): HTMLElement => {
  const article = document.querySelector('article.detail');
  if (!(article instanceof HTMLElement)) {
    throw new Error('Pas de fiche');
  }
  return article;
};

const serverKeeping = (initial: VehicleDto): FakeServer => {
  let kept = initial;
  const server = serverWithLists({}, { overview: overviewWith({ nouveau: 1 }) });
  server.on('GET', '/api/vehicles', (request) =>
    json(200, { vehicles: kept.status === request.query.get('status') ? [kept] : [], nextCursor: null }),
  );
  server.on(`GET`, `/api/vehicles/${initial.id}`, () => json(200, kept));
  server.on('POST', `/api/vehicles/${initial.id}`, (request) => {
    const change: VehicleUpdateRequest = typeof request.body === 'object' && request.body !== null ? request.body : {};
    kept = { ...kept, status: change.status === 'ignore' ? 'ignore' : 'nouveau' };
    return json(200, kept);
  });
  return server;
};

describe('fiche d’une annonce', () => {
  it('une Ferrari arrivée par un récapitulatif ParuVendu, sans date de publication, affiche « reçue il y a 5 min » et « date de publication non fournie par le site »', async () => {
    // Given
    itIsThursdayMorning();
    const fromRecap = ferrari360Langon({ publishedAt: null, firstSeenAt: '2026-10-16T08:55:00.000Z' });
    openedSheetOf(18);
    const server = serverWithLists({});
    server.on('GET', '/api/vehicles/18', () => json(200, fromRecap));

    // When
    await renderedApplication(server);

    // Then
    await waitFor(() =>
      expect(sheet().querySelector('.dhead .sub')?.textContent).toBe(
        'Langon, à 41 km · ParuVendu · reçue il y a 5 min (date de publication non fournie par le site)',
      ),
    );
    expect(sheet().querySelector('.dhead .hint')?.getAttribute('title')).toBe(
      'Ce site n’indique pas la date de publication dans ses listes ni dans ses alertes : la date affichée est celle de l’arrivée dans l’application.',
    );
  });

  it('après « Ignorer » sur la fiche, la liste revient ; « Annuler » depuis la liste y remet la Porsche sur place', async () => {
    // Given
    openedSheetOf(12);
    const server = serverKeeping(porsche911Merignac());
    await renderedApplication(server);
    fireEvent.click(await screen.findByRole('button', { name: 'Ignorer' }));
    await waitFor(() => expect(window.location.hash).toBe('#/annonces'));
    await waitFor(() => expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('1 annonce à traiter'));
    expect(document.querySelector('article.listing')).toBeNull();

    // When
    fireEvent.click(screen.getByRole('button', { name: 'Annuler' }));

    // Then
    await waitFor(() => expect(screen.getByRole('status').textContent).toBe('Annulé'));
    expect(window.location.hash).toBe('#/annonces');
    expect(document.querySelector('article.listing h3')?.textContent).toBe('Porsche 911 Carrera S');
    expect(server.requestsTo('POST', '/api/vehicles/12').map((request) => request.body)).toEqual([
      { status: 'ignore' },
      { status: 'nouveau' },
    ]);
  });

  it('la photo La Centrale, que le site refuse d’afficher ailleurs, laisse place à l’icône et au lien « Photos sur le site »', async () => {
    // Given
    const fromLaCentrale = porsche911Merignac({
      site: 'lacentrale',
      siteLabel: 'La Centrale',
      url: 'https://www.lacentrale.fr/auto-occasion-annonce-87102938475.html',
      imageUrl: 'https://photos.lacentrale.fr/2026/10/911-carrera-s.jpg',
    });
    openedSheetOf(12);
    const server = serverWithLists({});
    server.on('GET', '/api/vehicles/12', () => json(200, fromLaCentrale));
    await renderedApplication(server);
    const photo = await screen.findByRole('img', { name: fromLaCentrale.title });

    // When
    fireEvent.error(photo);

    // Then
    const link = await screen.findByRole('link', { name: 'Photos sur le site' });
    expect(link.className).toBe('photo empty');
    expect(link.getAttribute('href')).toBe('https://www.lacentrale.fr/auto-occasion-annonce-87102938475.html');
    expect(link.getAttribute('target')).toBe('_blank');
    expect(link.querySelector('svg')).not.toBeNull();
  });

  it('sur la fiche, le bouton « Ouvrir l’annonce et copier le message » vient en dernier et reste collant, après le message, la note et le texte reçu', async () => {
    // Given
    openedSheetOf(12);
    const server = serverWithLists({});
    server.on('GET', '/api/vehicles/12', () => json(200, porsche911Merignac()));

    // When
    await renderedApplication(server);

    // Then
    await waitFor(() => expect(sheet().lastElementChild?.className).toBe('primary-bar sticky'));
    expect(Array.from(sheet().children, (child) => child.className)).toEqual([
      'photo',
      'dhead',
      'specs',
      'badges',
      'message open',
      'vnote-field',
      'adv desc',
      'actions',
      'primary-bar sticky',
    ]);
    expect(sheet().querySelector('details.desc')?.hasAttribute('open')).toBe(true);
  });
});
