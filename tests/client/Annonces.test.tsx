import { act, fireEvent, screen, waitFor, within } from '@testing-library/preact';
import { describe, expect, it } from 'vitest';
import { json } from './support/fakeServer';
import { itIsThursdayMorning, serverWithLists } from './support/listsServer';
import { serverWithRejectedListings } from './support/rejectedListings';
import { renderedApplication, serverForSignedInDealer } from './support/testApplication';
import {
  audiA3SportbackNotSpecial,
  bmwM3TooManyKilometres,
  fiatPandaDisabledBrand,
  overviewWith,
  porsche911Merignac,
  porscheCayennePauTooFar,
  porscheWeekOfAlerts,
} from './support/vehicles';

const REJECTED_KINDS = { tous: 11, suivies: 4, loin: 2, km: 1, special: 1, pro: 0, marque: 3 } as const;

const LA_CENTRALE_TOO_NARROW =
  'La Centrale : L’alerte du site ne couvre que 50 km autour de la ville, vos réglages vont jusqu’à 150 km : les annonces entre les deux n’arriveront jamais.';

const chipTexts = (container: Element | null): readonly (string | null)[] =>
  Array.from(container?.querySelectorAll('button.chip') ?? [], (chip) => chip.textContent);

const shownCards = (): number => document.querySelectorAll('article.listing').length;

const bmwCard = (): HTMLElement => {
  const card = document.getElementById('v-21');
  if (card === null) {
    throw new Error('Pas de carte pour la BMW M3');
  }
  return card;
};

describe('écran Annonces', () => {
  it('une semaine chargée : le titre compte les annonces à traiter, la ligne des sept derniers jours résume l’activité, et la rafale est proposée', async () => {
    // Given
    itIsThursdayMorning();
    const overview = {
      ...overviewWith({ nouveau: 3 }),
      sources: [{ source: 'email', last_run_at: '2026-10-16T08:58:00.000Z', ok: 1, detail: '2 emails lus' } as const],
    };

    // When
    await renderedApplication(serverWithLists({ nouveau: [porsche911Merignac()] }, { overview }));

    // Then
    const headline = await waitFor(() => {
      const found = document.querySelector('.headline');
      expect(found).not.toBeNull();
      return found;
    });
    expect(headline?.querySelector('h1')?.textContent).toBe('3 annonces à traiter');
    expect(headline?.querySelector('p.muted')?.textContent).toBe('Bordeaux, 150 km · boîte mail vérifiée il y a 2 min');
    expect(headline?.querySelector('.week')?.textContent).toBe('7 derniers jours : 4 annonces retenues, 1 contactée, 0 réponse.');
    const burst = screen.getByRole('link', { name: 'Traiter en rafale (3)' });
    expect(burst.getAttribute('href')).toBe('#/rafale');
    expect(burst.className).toBe('btn primary rafale-cta');
    expect(chipTexts(document.querySelector('.view > .filterbar'))).toEqual([
      'À traiter3',
      'Contactées1',
      'Ont répondu',
      'Ignorées',
      'Écartées par les filtres',
      'Toutes',
    ]);
  });

  it('l’accueil qui ne peut pas être relu, le réseau coupé dans un tunnel, garde ses compteurs et la ligne des sept derniers jours, sans message', async () => {
    // Given
    const server = serverWithLists({ nouveau: [porsche911Merignac()] }, { overview: overviewWith({ nouveau: 3 }) });
    const state = await renderedApplication(server);
    await screen.findByRole('heading', { level: 1, name: '3 annonces à traiter' });
    server.on('GET', '/api/overview', () => {
      throw new TypeError('Failed to fetch');
    });

    // When
    act(() => state.refresh.request());
    await waitFor(() => expect(server.requestsTo('GET', '/api/overview')).toHaveLength(2));

    // Then
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('3 annonces à traiter');
    expect(document.querySelector('.headline .week')?.textContent).toBe('7 derniers jours : 4 annonces retenues, 1 contactée, 0 réponse.');
    expect(screen.getByRole('status').textContent).toBe('');
  });

  it('une alerte La Centrale plus étroite que les réglages est signalée en haut de la liste, avec le chemin vers Sites', async () => {
    // Given
    const overview = { ...overviewWith(), alertIssues: [LA_CENTRALE_TOO_NARROW] };

    // When
    await renderedApplication(serverWithLists({ nouveau: [porsche911Merignac()] }, { overview }));

    // Then
    const warning = await screen.findByRole('link', { name: /Une alerte à modifier sur le site/ });
    expect(warning.textContent).toBe(
      'Une alerte à modifier sur le site : La Centrale — elle ne couvre pas vos réglages. Voir dans Sites →',
    );
    expect(warning.getAttribute('href')).toBe('#/sources');
    expect(warning.className).toBe('note warn link');
  });

  it('avant de relier la boîte mail, la liste vide invite à relier la boîte mail des alertes', async () => {
    // Given
    const overview = {
      ...overviewWith({ nouveau: 0, contacte: 0 }),
      imapConfigured: false,
      week: { received: 0, contacted: 0, replied: 0 },
    };

    // When
    await renderedApplication(serverWithLists({ nouveau: [] }, { overview }));

    // Then
    const empty = await waitFor(() => {
      const found = document.querySelector('.stack .empty');
      expect(found).not.toBeNull();
      return found;
    });
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Rien à traiter pour le moment');
    expect(document.querySelector('.headline p.muted')?.textContent).toBe('Bordeaux, 150 km · boîte mail pas encore reliée');
    expect(document.querySelector('.headline .week')).toBeNull();
    expect(screen.queryByRole('link', { name: /Traiter en rafale/ })).toBeNull();
    expect(empty?.textContent).toBe(
      'Aucune annonce en attenteLes nouvelles annonces arrivent ici dès qu’un site envoie une alerte.Relier la boîte mail des alertes',
    );
    expect(screen.getByRole('link', { name: 'Relier la boîte mail des alertes' }).getAttribute('href')).toBe('#/sources');
  });

  it('« Écartées par les filtres » propose les groupes de raisons avec leur compteur, et un groupe se choisit d’un toucher', async () => {
    // Given
    const server = serverWithLists({ nouveau: [porsche911Merignac()], ecartees: [bmwM3TooManyKilometres()] }, { kinds: REJECTED_KINDS });
    await renderedApplication(server);

    // When
    fireEvent.click(await screen.findByRole('button', { name: 'Écartées par les filtres' }));
    await screen.findByText('BMW M3');
    fireEvent.click(screen.getByRole('button', { name: 'Trop de km1' }));
    await waitFor(() => expect(server.requestsTo('GET', '/api/vehicles')).toHaveLength(3));

    // Then
    const kinds = document.querySelector('.kinds');
    expect(kinds?.querySelector('p')?.textContent).toBe(
      'Les 14 derniers jours. Un coup d’œil de temps en temps : « Garder quand même » remet une annonce à traiter.',
    );
    expect(chipTexts(kinds)).toEqual([
      'Marques suivies4',
      'Trop loin2',
      'Trop de km1',
      'Ni supercar ni collection1',
      'Vendeur pro',
      'Autres marques3',
      'Toutes11',
    ]);
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Écartées par les filtres');
    expect(screen.getByRole('button', { name: 'Écartées par les filtres' }).getAttribute('aria-pressed')).toBe('true');
    await waitFor(() => expect(screen.getByRole('button', { name: 'Trop de km1' }).getAttribute('aria-pressed')).toBe('true'));
    expect(server.requests.filter((request) => request.path === '/api/vehicles').map((request) => request.url)).toEqual([
      '/api/vehicles?status=nouveau',
      '/api/vehicles?status=ecartees&kind=suivies',
      '/api/vehicles?status=ecartees&kind=km',
    ]);
  });

  it('« Garder quand même » sur la BMW M3 écartée pour ses 128 000 km la sort des écartées et la remet à traiter, puis les compteurs relus sur le serveur retirent celui de « Trop de km »', async () => {
    // Given
    const server = serverWithRejectedListings([
      { vehicle: bmwM3TooManyKilometres(), groups: ['km'] },
      { vehicle: audiA3SportbackNotSpecial(), groups: ['special'] },
      { vehicle: porscheCayennePauTooFar(), groups: ['loin'] },
      { vehicle: fiatPandaDisabledBrand(), groups: ['marque'] },
    ]);
    await renderedApplication(server);
    fireEvent.click(await screen.findByRole('button', { name: 'Écartées par les filtres' }));
    const reasons = await screen.findByText('128 000 km, au-delà de vos 100 000 km');
    const before = chipTexts(document.querySelector('.kinds'));

    // When
    fireEvent.click(within(bmwCard()).getByRole('button', { name: 'Garder quand même' }));

    // Then
    expect(reasons.closest('ul')?.className).toBe('reasons');
    await waitFor(() => expect(document.getElementById('v-21')).toBeNull());
    expect(shownCards()).toBe(2);
    expect(screen.getByRole('status').firstChild?.textContent).toBe('Annonce gardée');
    expect(server.requestsTo('POST', '/api/vehicles/21').map((request) => request.body)).toEqual([{ keep: true, status: 'nouveau' }]);
    expect(before).toEqual([
      'Marques suivies3',
      'Trop loin1',
      'Trop de km1',
      'Ni supercar ni collection1',
      'Vendeur pro',
      'Autres marques1',
      'Toutes4',
    ]);
    await waitFor(() =>
      expect(chipTexts(document.querySelector('.kinds'))).toEqual([
        'Marques suivies2',
        'Trop loin1',
        'Trop de km',
        'Ni supercar ni collection1',
        'Vendeur pro',
        'Autres marques1',
        'Toutes3',
      ]),
    );
  });

  it('une semaine d’alertes larges : « Charger plus » ajoute les 5 Porsche suivantes sous les 50 premières', async () => {
    // Given
    const week = porscheWeekOfAlerts(55);
    const server = serverForSignedInDealer();
    server.on('GET', '/api/overview', () => json(200, overviewWith({ nouveau: 55 })));
    server.on('GET', '/api/vehicles', (request) =>
      request.query.get('cursor') === null
        ? json(200, { vehicles: week.slice(0, 50), nextCursor: 'apres-la-50e' })
        : json(200, { vehicles: week.slice(50), nextCursor: null }),
    );
    await renderedApplication(server);
    const more = await screen.findByRole('button', { name: 'Charger plus' });
    const firstPage = shownCards();

    // When
    fireEvent.click(more);

    // Then
    await waitFor(() => expect(shownCards()).toBe(55));
    expect(firstPage).toBe(50);
    expect(more.className).toBe('btn more');
    expect(screen.queryByRole('button', { name: 'Charger plus' })).toBeNull();
    expect(server.requestsTo('GET', '/api/vehicles').map((request) => request.url)).toEqual([
      '/api/vehicles?status=nouveau',
      '/api/vehicles?status=nouveau&cursor=apres-la-50e',
    ]);
  });
});
