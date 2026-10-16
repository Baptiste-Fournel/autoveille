import { fireEvent, screen, waitFor } from '@testing-library/preact';
import { describe, expect, it } from 'vitest';
import { json } from './support/fakeServer';
import { itIsThursdayMorning, serverWithLists } from './support/listsServer';
import { renderedApplication } from './support/testApplication';
import { porsche911Merignac } from './support/vehicles';

const cardOf = (name: string): HTMLElement => {
  const card = screen.getByText(name).closest('article');
  if (card === null) {
    throw new Error(`Pas de carte pour ${name}`);
  }
  return card;
};

describe('carte d’une annonce dans la liste', () => {
  it('la Porsche contactée il y a trois jours dit « Contactée il y a 3 j, sans réponse pour l’instant »', async () => {
    // Given
    itIsThursdayMorning();
    const contacted = porsche911Merignac({ status: 'contacte', contactedAt: '2026-10-13T08:30:00.000Z' });
    await renderedApplication(serverWithLists({ contacte: [contacted] }));
    fireEvent.click(await screen.findByRole('button', { name: /^Contactées/ }));

    // When
    const card = await waitFor(() => cardOf('Porsche 911 Carrera S'));

    // Then
    expect(card.querySelector('.follow')?.textContent).toBe('Contactée il y a 3 j, sans réponse pour l’instant');
  });

  it('une annonce La Centrale située seulement « Gironde (33) » affiche le département, sans distance', async () => {
    // Given
    itIsThursdayMorning();
    const locatedByDepartment = porsche911Merignac({
      site: 'lacentrale',
      siteLabel: 'La Centrale',
      city: 'Gironde',
      postalCode: '33',
      distanceKm: 25,
      publishedAt: '2026-10-16T08:40:00.000Z',
    });

    // When
    await renderedApplication(serverWithLists({ nouveau: [locatedByDepartment] }));

    // Then
    const card = await waitFor(() => cardOf('Porsche 911 Carrera S'));
    expect(card.querySelectorAll('.title .sub')[1]?.textContent).toBe('Gironde · La Centrale · publiée il y a 20 min');
  });

  it('toucher la photo ou le titre de la Porsche ouvre sa fiche', async () => {
    // Given
    const server = serverWithLists({ nouveau: [porsche911Merignac()] });
    server.on('GET', '/api/vehicles/12', () => json(200, porsche911Merignac()));
    await renderedApplication(server);
    const [photo, title] = await screen.findAllByRole('link', { name: 'Voir la fiche : Porsche 911 Carrera S' });

    // When
    fireEvent.click(title ?? document.body);

    // Then
    expect(photo?.querySelector('img.thumb')).not.toBeNull();
    expect(photo?.getAttribute('href')).toBe('#/annonce/12');
    await waitFor(() => expect(window.location.hash).toBe('#/annonce/12'));
    expect(await screen.findByRole('heading', { level: 2, name: 'Porsche 911 Carrera S' })).toBeTruthy();
  });

  it('une Porsche connue par un récapitulatif de baisses de prix, sans photo, affiche « photo sur le site » au lieu d’une image cassée', async () => {
    // Given
    const fromDigest = porsche911Merignac({ imageUrl: null, priceDropped: true });

    // When
    await renderedApplication(serverWithLists({ nouveau: [fromDigest] }));

    // Then
    const card = await waitFor(() => cardOf('Porsche 911 Carrera S'));
    const thumb = card.querySelector('.thumb.empty');
    expect(thumb?.textContent).toBe('photo sur le site');
    expect(thumb?.getAttribute('title')).toBe('Le site n’a pas transmis de photo : elle est sur l’annonce.');
    expect(card.querySelector('img')).toBeNull();
    expect(Array.from(card.querySelectorAll('.badge'), (badge) => badge.textContent)).toContain('Prix baissé');
  });

  it('la photo La Centrale que le site refuse d’afficher ailleurs laisse place à « photo sur le site »', async () => {
    // Given
    const hotlinkRefused = porsche911Merignac({ imageUrl: 'https://photos.lacentrale.fr/2026/10/911-carrera-s.jpg' });
    await renderedApplication(serverWithLists({ nouveau: [hotlinkRefused] }));
    const card = await waitFor(() => cardOf('Porsche 911 Carrera S'));
    const image = card.querySelector('img.thumb');

    // When
    fireEvent.error(image ?? document.body);

    // Then
    expect(card.querySelector('img')).toBeNull();
    expect(card.querySelector('.thumb.empty')?.textContent).toBe('photo sur le site');
  });
});
