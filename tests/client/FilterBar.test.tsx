import { fireEvent, screen, waitFor } from '@testing-library/preact';
import { describe, expect, it } from 'vitest';
import { serverWithLists } from './support/listsServer';
import { renderedApplication } from './support/testApplication';
import { alpineA110Pessac, ferrari360Langon, porsche911Merignac } from './support/vehicles';

const mustangBlanquefort = porsche911Merignac({
  id: 24,
  name: 'Ford Mustang GT',
  title: 'Ford Mustang GT 5.0 V8 450ch',
  make: 'Ford',
  model: 'Mustang GT',
  family: 'americaines',
  familyLabel: 'Américaines',
  year: 2018,
  km: 38000,
  price: 44900,
  city: 'Blanquefort',
  postalCode: '33290',
  distanceKm: 14,
  specialReason: 'mot-clé « Mustang »',
  firstSeenAt: '2026-10-12T18:25:00.000Z',
  lastSeenAt: '2026-10-12T18:25:00.000Z',
  publishedAt: '2026-10-12T18:20:00.000Z',
  url: 'https://www.leboncoin.fr/ad/voitures/2809876543',
});

const fourToHandle = [porsche911Merignac(), alpineA110Pessac(), ferrari360Langon(), mustangBlanquefort];

const shownNames = (): readonly (string | null)[] =>
  Array.from(document.querySelectorAll('article.listing h3'), (title) => title.textContent);

const filtersButton = (): HTMLElement => screen.getByRole('button', { name: /^Filtres/ });

const openWithFourToHandle = async (): Promise<void> => {
  await renderedApplication(serverWithLists({ nouveau: fourToHandle }));
  await waitFor(() => expect(shownNames()).toHaveLength(4));
};

describe('recherche et filtres de la liste', () => {
  it('chercher « merignac » sans accent ne garde que la Porsche de Mérignac', async () => {
    // Given
    await openWithFourToHandle();

    // When
    fireEvent.input(screen.getByRole('searchbox', { name: 'Rechercher dans la liste' }), { target: { value: 'merignac' } });

    // Then
    expect(shownNames()).toEqual(['Porsche 911 Carrera S']);
    expect(document.querySelector('.count-line')?.textContent).toBe('1 sur 4 annonces');
  });

  it('taper une recherche filtre la liste sans remplacer le champ où l’on écrit, et le tri choisi reste mémorisé sur l’appareil', async () => {
    // Given
    await openWithFourToHandle();
    const search = screen.getByRole('searchbox', { name: 'Rechercher dans la liste' });
    search.focus();

    // When
    fireEvent.input(search, { target: { value: 'f' } });
    fireEvent.input(search, { target: { value: 'fo' } });
    fireEvent.input(search, { target: { value: 'ford' } });
    fireEvent.click(filtersButton());
    fireEvent.click(screen.getByRole('button', { name: 'Prix croissant' }));

    // Then
    expect(screen.getByRole('searchbox', { name: 'Rechercher dans la liste' })).toBe(search);
    expect(document.activeElement).toBe(search);
    expect(shownNames()).toEqual(['Ford Mustang GT']);
    expect(window.localStorage.getItem('av_filters')).toBe(
      '{"sort":"priceAsc","families":[],"sites":[],"priceMin":null,"priceMax":null,"distMax":null}',
    );
    expect(window.localStorage.getItem('av_filters_open')).toBe('1');
  });

  it('faire glisser la poignée du prix maximum à 60 000 € écarte en direct la Porsche à 89 900 € et la Ferrari à 79 000 €', async () => {
    // Given
    await openWithFourToHandle();
    fireEvent.click(filtersButton());

    // When
    fireEvent.input(screen.getByRole('slider', { name: 'Prix maximum' }), { target: { value: '60000' } });

    // Then
    expect(shownNames()).toEqual(['Alpine A110 Légende', 'Ford Mustang GT']);
    expect(document.querySelector('.range2')?.nextElementSibling?.textContent).toBe('0 € – 60 000 €');
    expect(filtersButton().querySelector('.badge.count')?.textContent).toBe('1');
    expect(JSON.parse(window.localStorage.getItem('av_filters') ?? '{}')).toMatchObject({ priceMin: null, priceMax: 60000 });
  });

  it('des filtres mémorisés illisibles (stockage du téléphone abîmé) laissent place aux filtres par défaut', async () => {
    // Given
    window.localStorage.setItem('av_filters', '{"sort":"priceAsc","families":[');

    // When
    await openWithFourToHandle();

    // Then
    expect(shownNames()).toEqual(['Porsche 911 Carrera S', 'Alpine A110 Légende', 'Ferrari 360 Modena', 'Ford Mustang GT']);
    expect(filtersButton().getAttribute('aria-expanded')).toBe('false');
    expect(filtersButton().querySelector('.badge')).toBeNull();
    expect(screen.getByRole('button', { name: 'Plus récentes' }).getAttribute('aria-pressed')).toBe('true');
  });

  it('le tri « Prix croissant » choisi avec l’application d’avant la mise à jour est retrouvé, panneau des filtres ouvert', async () => {
    // Given
    window.localStorage.setItem(
      'av_filters',
      '{"sort":"priceAsc","families":[],"sites":[],"priceMin":null,"priceMax":null,"distMax":null}',
    );
    window.localStorage.setItem('av_filters_open', '0');

    // When
    await openWithFourToHandle();

    // Then
    expect(shownNames()).toEqual(['Ford Mustang GT', 'Alpine A110 Légende', 'Ferrari 360 Modena', 'Porsche 911 Carrera S']);
    expect(filtersButton().getAttribute('aria-expanded')).toBe('true');
    expect(filtersButton().querySelector('.badge.count')?.textContent).toBe('1');
    expect(screen.getByRole('button', { name: 'Prix croissant' }).getAttribute('aria-pressed')).toBe('true');
  });
});
