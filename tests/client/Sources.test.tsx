import { act, fireEvent, screen, waitFor, within } from '@testing-library/preact';
import { describe, expect, it, vi } from 'vitest';
import type { SettingsDto } from '../../src/shared/api';
import { json } from './support/fakeServer';
import {
  bordeauxDealerSettings,
  emailCutByGmail,
  laCentraleConfirmedTooNarrow,
  laCentraleSixtyOneAnnounced,
  leboncoinFavouritesWithoutListing,
  leboncoinToCreate,
  mailboxPassWithOneError,
  paruvenduOneFerrari,
  serverForSitesScreen,
  sitesOf,
} from './support/sitesWorld';
import { renderedApplication } from './support/testApplication';

const openSites = async (server: ReturnType<typeof serverForSitesScreen>) => {
  window.location.hash = '#/sources';
  const state = await renderedApplication(server);
  await screen.findByRole('heading', { name: 'Boîte mail des alertes' });
  return state;
};

const siteBlock = (label: string): HTMLElement => {
  const heading = screen.getByRole('heading', { name: label, level: 3 });
  const block = heading.closest('.site');
  if (!(block instanceof HTMLElement)) {
    throw new Error(`Bloc du site ${label} absent`);
  }
  return block;
};

const savedSettings = (server: ReturnType<typeof serverForSitesScreen>, index = 0): SettingsDto =>
  server.requestsTo('PUT', '/api/settings')[index]?.body as SettingsDto;

describe('écran Sites', () => {
  it('l’alerte La Centrale confirmée par email s’affiche « Alerte active » avec les critères envoyés par le site, et « Modifier l’alerte sur le site » ouvre sa page de gestion', async () => {
    // Given
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-16T08:00:00.000Z'));
    const server = serverForSitesScreen();

    // When
    await openSites(server);

    // Then
    const laCentrale = within(siteBlock('La Centrale'));
    expect(laCentrale.getByText('Alerte active')).toBeTruthy();
    expect(laCentrale.getByText('Ce que le site enverra :').closest('p')?.textContent).toBe(
      'Ce que le site enverra : 80 000 km max, 33000 (rayon de 50 km), particuliers (confirmé par le site le 12 oct.)',
    );
    const manage = laCentrale.getByRole('link', { name: 'Modifier l’alerte sur le site' });
    expect(manage.getAttribute('href')).toBe('https://www.lacentrale.fr/compte/notification/recherche');
    expect(manage.getAttribute('target')).toBe('_blank');
    expect(laCentrale.queryByRole('button', { name: 'Pas encore créée' })).toBeNull();
  });

  it('une alerte La Centrale plus étroite que les réglages (50 km, 80 000 km) : les deux écarts sont signalés et la recherche pré-remplie plus large est rappelée', async () => {
    // Given
    const server = serverForSitesScreen(sitesOf({ sites: [{ ...laCentraleConfirmedTooNarrow, digest: null }] }));

    // When
    await openSites(server);

    // Then
    const notes = [...siteBlock('La Centrale').querySelectorAll('.note')].map((note) => [note.className, note.textContent]);
    expect(notes).toEqual([
      [
        'note warn',
        'L’alerte du site ne couvre que 50 km autour de la ville, vos réglages vont jusqu’à 100 km : les annonces entre les deux n’arriveront jamais.',
      ],
      ['note warn', 'L’alerte du site s’arrête à 80 000 km au compteur, vos réglages acceptent jusqu’à 100 000 km.'],
    ]);
    expect(
      within(siteBlock('La Centrale')).getByText(
        /^La recherche pré-remplie prend 150 km autour de Bordeaux, 150 000 km au compteur maximum/,
      ).textContent,
    ).toBe(
      'La recherche pré-remplie prend 150 km autour de Bordeaux, 150 000 km au compteur maximum, vendeurs particuliers, toutes marques : exprès plus large que vos réglages. Lancez une recherche avec vos critères, puis « Créer une alerte » (compte gratuit) et choisissez la réception par email à chaque nouvelle annonce.',
    );
  });

  it('l’email La Centrale « 61 nouveaux véhicules » dont 2 seulement sont arrivés : l’écart reste signalé trois jours avec le lien vers les 59 autres, puis disparaît', async () => {
    // Given
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-16T08:00:00.000Z'));
    const server = serverForSitesScreen();
    const state = await openSites(server);
    const digest = siteBlock('La Centrale').querySelector('.note.digest');
    const rest = within(siteBlock('La Centrale')).getByRole('link', { name: 'Voir les 59 autres sur La Centrale' });

    // When
    vi.setSystemTime(new Date('2026-10-16T10:00:00.000Z'));
    act(() => state.refresh.request());

    // Then
    expect(digest?.textContent).toBe(
      '61 nouvelles annonces annoncées le 13 oct., 2 arrivées dans l’application. Ce site n’envoie par email qu’un aperçu : les 59 autres ne sont visibles que sur le site, et l’application ne peut pas aller les lire à votre place.Voir les 59 autres sur La Centrale',
    );
    expect(rest.getAttribute('href')).toBe('https://www.lacentrale.fr/listing?customerFamilyCodes=PART');
    await waitFor(() => expect(siteBlock('La Centrale').querySelector('.note.digest')).toBeNull());
  });

  it('« Alertes ciblées recommandées » s’affiche sous La Centrale, dont les emails ne montrent que quelques annonces : une recherche par petit groupe de marques, ouverte sur le site', async () => {
    // Given
    const server = serverForSitesScreen();

    // When
    await openSites(server);

    // Then
    const targeted = within(siteBlock('La Centrale')).getByText('Alertes ciblées recommandées (4)').closest('details');
    const searches = within(targeted ?? document.body).getAllByRole('link');
    expect(searches.map((search) => search.textContent)).toEqual([
      'Porsche à partir de 30 000 €',
      'Mercedes-Benz à partir de 30 000 €',
      'Ferrari, Lamborghini, Maserati à partir de 20 000 €',
      'Alpine, Bugatti, Renault à partir de 35 000 €',
    ]);
    expect(searches[2]?.getAttribute('href')).toBe(
      'https://www.lacentrale.fr/listing?makesModelsCommercialNames=FERRARI%3BLAMBORGHINI%3BMASERATI&priceMin=20000&customerFamilyCodes=PART&distance=5&dptCp=33000&mileageMax=150000&sortBy=firstOnlineDateDesc',
    );
    expect(searches.every((search) => search.getAttribute('target') === '_blank')).toBe(true);
    expect(within(siteBlock('Leboncoin')).queryByText(/Alertes ciblées recommandées/)).toBeNull();
  });

  it('« C’est fait » sous Leboncoin, une fois l’alerte créée sur le site : l’alerte est notée comme créée et Leboncoin passe à « Alerte créée »', async () => {
    // Given
    const server = serverForSitesScreen();
    await openSites(server);
    const leboncoin = within(siteBlock('Leboncoin'));
    expect(leboncoin.getByText('À créer')).toBeTruthy();
    expect(leboncoin.getByRole('link', { name: 'Créer l’alerte (recherche pré-remplie)' }).getAttribute('href')).toBe(
      leboncoinToCreate.searchUrl,
    );
    server.on('GET', '/api/sources', () => json(200, sitesOf({ sites: [{ ...leboncoinToCreate, done: true }] })));

    // When
    fireEvent.click(leboncoin.getByRole('button', { name: 'C’est fait' }));

    // Then
    expect(await screen.findByText('Alerte Leboncoin notée comme créée')).toBeTruthy();
    await waitFor(() => expect(within(siteBlock('Leboncoin')).queryByText('Alerte créée')).not.toBeNull());
    expect(savedSettings(server).alertsDone).toEqual({ lacentrale: true, leboncoin: true });
    expect(within(siteBlock('Leboncoin')).getByRole('link', { name: 'Modifier l’alerte sur le site' }).getAttribute('href')).toBe(
      'https://www.leboncoin.fr/mes-recherches',
    );
  });

  it('« Pas encore créée » sur Leboncoin noté créé par erreur : Leboncoin redevient « À créer »', async () => {
    // Given
    const server = serverForSitesScreen(sitesOf({ sites: [{ ...leboncoinToCreate, done: true }] }), {
      ...bordeauxDealerSettings,
      alertsDone: { leboncoin: true },
    });
    await openSites(server);
    server.on('GET', '/api/sources', () => json(200, sitesOf({ sites: [leboncoinToCreate] })));

    // When
    fireEvent.click(within(siteBlock('Leboncoin')).getByRole('button', { name: 'Pas encore créée' }));

    // Then
    expect(await screen.findByText('Noté')).toBeTruthy();
    await waitFor(() => expect(within(siteBlock('Leboncoin')).queryByText('À créer')).not.toBeNull());
    expect(savedSettings(server).alertsDone).toEqual({ leboncoin: false });
  });

  it('les sites facultatifs comme L’argus sont rangés à part, avec un lien vers le site sans recherche pré-remplie', async () => {
    // Given
    const server = serverForSitesScreen();

    // When
    await openSites(server);

    // Then
    const optional = screen.getByText('Autres sites, facultatifs').closest('details');
    expect(optional?.contains(siteBlock('L’argus'))).toBe(true);
    expect(optional?.contains(siteBlock('Leboncoin'))).toBe(false);
    expect(within(siteBlock('L’argus')).getByRole('link', { name: 'Créer l’alerte sur le site' }).getAttribute('href')).toBe(
      'https://occasion.largus.fr/voiture-occasion/',
    );
    expect(within(siteBlock('L’argus')).getByText(/^Après une recherche/).textContent).toBe(
      'Après une recherche, « Créer une alerte » puis choisissez la fréquence « dès qu’une annonce est publiée ».',
    );
  });

  it('le concessionnaire colle l’adresse Gmail dédiée et le mot de passe d’application, teste la connexion, puis enregistre la boîte', async () => {
    // Given
    const server = serverForSitesScreen();
    server.on('POST', '/api/sources/imap/test', () => json(200, { ok: true, detail: 'Connexion réussie, 12 email(s) dans la boîte.' }));
    await openSites(server);

    // When
    fireEvent.input(screen.getByLabelText('Adresse Gmail dédiée'), { target: { value: 'alertes.autosdusudouest@gmail.com' } });
    fireEvent.input(screen.getByLabelText('Mot de passe d’application'), { target: { value: 'abcd efgh ijkl mnop' } });
    fireEvent.click(screen.getByRole('button', { name: 'Tester la connexion' }));
    const result = await screen.findByText('Connexion réussie, 12 email(s) dans la boîte.');
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }));

    // Then
    expect(result.className).toBe('note ok');
    expect(server.requestsTo('POST', '/api/sources/imap/test')[0]?.body).toEqual({
      host: 'imap.gmail.com',
      port: 993,
      user: 'alertes.autosdusudouest@gmail.com',
      pass: 'abcd efgh ijkl mnop',
      mailbox: 'INBOX',
    });
    expect(await screen.findByText('Boîte mail enregistrée')).toBeTruthy();
    expect(savedSettings(server).imap).toEqual({
      host: 'imap.gmail.com',
      port: 993,
      user: 'alertes.autosdusudouest@gmail.com',
      pass: 'abcd efgh ijkl mnop',
      mailbox: 'INBOX',
    });
  });

  it('une boîte hébergée ailleurs que chez Gmail : serveur, port et dossier se règlent dans « Autre fournisseur que Gmail »', async () => {
    // Given
    const server = serverForSitesScreen();
    await openSites(server);

    // When
    fireEvent.input(screen.getByLabelText('Serveur IMAP'), { target: { value: 'imap.ionos.fr' } });
    fireEvent.input(screen.getByLabelText('Port'), { target: { value: '' } });
    const whileTyping = screen.getByLabelText<HTMLInputElement>('Port').value;
    fireEvent.input(screen.getByLabelText('Port'), { target: { value: '143' } });
    fireEvent.input(screen.getByLabelText('Dossier'), { target: { value: 'Alertes' } });
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }));

    // Then
    expect(whileTyping).toBe('');
    expect(await screen.findByText('Boîte mail enregistrée')).toBeTruthy();
    expect(savedSettings(server).imap).toEqual({ host: 'imap.ionos.fr', port: 143, user: '', pass: '', mailbox: 'Alertes' });
  });

  it('l’adresse Gmail saisie dans Sites mais pas encore enregistrée est toujours là après un passage par Réglages', async () => {
    // Given
    const server = serverForSitesScreen();
    await openSites(server);
    fireEvent.input(screen.getByLabelText('Adresse Gmail dédiée'), { target: { value: 'alertes.autosdusudouest@gmail.com' } });

    // When
    window.location.hash = '#/reglages';
    window.dispatchEvent(new HashChangeEvent('hashchange'));
    await waitFor(() => expect(screen.queryByLabelText('Adresse Gmail dédiée')).toBeNull());
    window.location.hash = '#/sources';
    window.dispatchEvent(new HashChangeEvent('hashchange'));

    // Then
    expect((await screen.findByLabelText<HTMLInputElement>('Adresse Gmail dédiée')).value).toBe('alertes.autosdusudouest@gmail.com');
    expect(server.requestsTo('PUT', '/api/settings')).toHaveLength(0);
  });

  it('la boîte dont le dernier passage a buté sur un email coupé par Gmail affiche « Problème » et le compte rendu en rouge', async () => {
    // Given
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-16T08:00:00.000Z'));
    const server = serverForSitesScreen(
      sitesOf({
        imap: {
          host: 'imap.gmail.com',
          port: 993,
          user: 'alertes.autosdusudouest@gmail.com',
          hasPassword: true,
          mailbox: 'INBOX',
          configured: true,
          lastRun: mailboxPassWithOneError,
        },
      }),
    );

    // When
    await openSites(server);

    // Then
    const mailbox = screen.getByRole('heading', { name: 'Boîte mail des alertes' }).closest('section');
    expect(within(mailbox ?? document.body).getByText('Problème').className).toBe('badge warn');
    const report = within(mailbox ?? document.body).getByText(/Unexpected close$/);
    expect(report.textContent).toBe(
      'le 13 oct. : 2 email(s) lu(s), 3 annonce(s), 2 nouvelle(s) correspondant aux réglages ; 1 erreur(s) : uid 41: Unexpected close',
    );
    expect(report.style.color).toBe('var(--danger)');
  });

  it('toucher l’email La Centrale dans « Derniers emails reçus » déplie les annonces reconnues, celle du vendeur pro signalée « (pro) »', async () => {
    // Given
    const server = serverForSitesScreen(sitesOf({ emails: [laCentraleSixtyOneAnnounced] }));
    await openSites(server);
    const row = screen.getByText('61 nouveaux véhicules correspondent à votre recherche').closest('tr');
    const detail = row?.nextElementSibling;
    const hiddenBefore = detail?.className;

    // When
    fireEvent.click(screen.getByText('61 nouveaux véhicules correspondent à votre recherche'));

    // Then
    expect(hiddenBefore).toBe('hidden');
    expect(detail?.className).toBe('');
    expect(row?.querySelector('td.n')?.textContent).toBe('2 annonces61 annoncées');
    expect([...(detail?.querySelectorAll('li') ?? [])].map((item) => item.textContent)).toEqual([
      'Mercedes-AMG C63 S Coupé, 64 900 €, 45 200 km, 2019, Libourne',
      'Porsche 911 (997) Carrera S 3.8 355ch, 54 900 €, 89 000 km, 2006, Angoulême (pro)',
    ]);
  });

  it('l’email ParuVendu « 1 nouvelle annonce » arrivé en entier compte « 1 annonce », sans écart signalé avec le site', async () => {
    // Given
    const server = serverForSitesScreen(sitesOf({ emails: [paruvenduOneFerrari] }));

    // When
    await openSites(server);

    // Then
    const row = screen.getByText('🚗 1 nouvelle annonce').closest('tr');
    expect(row?.querySelector('td.n')?.textContent).toBe('1 annonce');
    expect(row?.querySelector('.badge')).toBeNull();
    expect(row?.nextElementSibling?.querySelector('li')?.textContent).toBe('Ferrari 360 Modena F1, 79 000 €, 45 000 km, 2001, Langon');
  });

  it('l’email Leboncoin « Vos favoris vous attendent », où aucune annonce n’est reconnue, compte « 0 annonce » dans le journal, et le déplier le dit', async () => {
    // Given
    const server = serverForSitesScreen(sitesOf({ emails: [leboncoinFavouritesWithoutListing] }));
    await openSites(server);
    const row = screen.getByText('Vos favoris vous attendent').closest('tr');

    // When
    fireEvent.click(screen.getByText('Vos favoris vous attendent'));

    // Then
    expect(row?.querySelector('td.n')?.textContent).toBe('0 annonce');
    expect(row?.nextElementSibling?.className).toBe('');
    expect(row?.nextElementSibling?.textContent).toBe('Aucune annonce reconnue dans cet email.');
  });

  it('un email que Gmail a coupé en pleine lecture apparaît « Erreur » dans le journal, et le déplier donne la raison', async () => {
    // Given
    const server = serverForSitesScreen(sitesOf({ emails: [emailCutByGmail] }));
    await openSites(server);

    // When
    fireEvent.click(screen.getByText('Erreur'));

    // Then
    const reason = screen.getByText('Unexpected close');
    expect(reason.className).toBe('note warn');
    expect(reason.closest('tr')?.className).toBe('');
  });

  it('« Vérifier maintenant » relève la boîte tout de suite : le bouton patiente, puis le compte rendu s’affiche et le journal montre l’email arrivé', async () => {
    // Given
    const server = serverForSitesScreen();
    await openSites(server);
    let answer: (response: Response) => void = () => undefined;
    server.on('POST', '/api/sources/check-now', () => new Promise<Response>((resolve) => (answer = resolve)));
    server.on('GET', '/api/sources', () => json(200, sitesOf({ emails: [laCentraleSixtyOneAnnounced] })));

    // When
    fireEvent.click(screen.getByRole('button', { name: 'Vérifier maintenant' }));
    const waiting = await screen.findByRole('button', { name: 'Vérification…' });
    answer(
      json(200, {
        mail: { source: 'email', ok: true, detail: '1 email(s) lu(s), 2 annonce(s), 1 nouvelle(s) correspondant aux réglages' },
        http: [],
      }),
    );

    // Then
    expect(waiting.hasAttribute('disabled')).toBe(true);
    expect(await screen.findByText('1 email(s) lu(s), 2 annonce(s), 1 nouvelle(s) correspondant aux réglages')).toBeTruthy();
    expect(await screen.findByText('61 nouveaux véhicules correspondent à votre recherche')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Vérifier maintenant' }).hasAttribute('disabled')).toBe(false);
  });

  it('« Tout relire » après une mise à jour de l’application : la confirmation acceptée relit toute la boîte et dit ce qui a été lu', async () => {
    // Given
    const server = serverForSitesScreen();
    server.on('POST', '/api/sources/reread', () =>
      json(200, { mail: { source: 'email', ok: false, detail: 'Boîte mail non configurée.' } }),
    );
    const question = vi.spyOn(window, 'confirm').mockReturnValue(true);
    await openSites(server);

    // When
    fireEvent.click(screen.getByRole('button', { name: 'Tout relire' }));

    // Then
    expect(question).toHaveBeenCalledWith(
      'Relire toute la boîte mail depuis le début ? Les annonces déjà connues sont complétées, pas dupliquées. Utile après une mise à jour de l’application.',
    );
    expect(await screen.findByText('Boîte mail non configurée.')).toBeTruthy();
    expect(document.getElementById('toast')?.className).toBe('show error');
    expect(server.requestsTo('POST', '/api/sources/reread')).toHaveLength(1);
  });

  it('« Tout relire » touché par erreur : refuser la confirmation ne relit rien', async () => {
    // Given
    const server = serverForSitesScreen();
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    await openSites(server);

    // When
    fireEvent.click(screen.getByRole('button', { name: 'Tout relire' }));

    // Then
    expect(server.requestsTo('POST', '/api/sources/reread')).toHaveLength(0);
    expect(screen.getByRole('button', { name: 'Tout relire' }).hasAttribute('disabled')).toBe(false);
  });

  it('« Ajouter ce site » sans avoir collé l’adresse de la page de résultats demande l’adresse, sans rien enregistrer', async () => {
    // Given
    const server = serverForSitesScreen();
    await openSites(server);
    fireEvent.input(screen.getByLabelText('Nom du site'), { target: { value: 'Annonces-Automobile' } });

    // When
    fireEvent.click(screen.getByRole('button', { name: 'Ajouter ce site' }));

    // Then
    expect(await screen.findByText('Indiquez l’adresse de la page.')).toBeTruthy();
    expect(server.requestsTo('PUT', '/api/settings')).toHaveLength(0);
  });

  it('tester une page de résultats Annonces-Automobile montre les annonces que l’application y lit', async () => {
    // Given
    const server = serverForSitesScreen();
    server.on('POST', '/api/sources/http/test', () =>
      json(200, {
        ok: true,
        detail: '2 annonce(s) lue(s) (données structurées).',
        sample: [
          {
            title: 'Porsche 911 Carrera 4S',
            price: 94900,
            km: 38000,
            year: 2017,
            city: 'Arcachon',
            url: 'https://www.annonces-automobile.com/a/1',
          },
          { title: 'Alpine A110 Pure', price: 54500, url: 'https://www.annonces-automobile.com/a/2' },
        ],
      }),
    );
    await openSites(server);
    fireEvent.input(screen.getByLabelText('Adresse de la page de résultats'), {
      target: { value: 'https://www.annonces-automobile.com/recherche?marque=porsche' },
    });

    // When
    fireEvent.click(screen.getByRole('button', { name: 'Tester cette page' }));

    // Then
    const result = await screen.findByText('2 annonce(s) lue(s) (données structurées).');
    expect(result.className).toBe('note ok');
    expect([...result.querySelectorAll('li')].map((item) => item.textContent)).toEqual([
      'Porsche 911 Carrera 4S, 94 900 €, 38 000 km, Arcachon',
      'Alpine A110 Pure, 54 500 €',
    ]);
    expect(server.requestsTo('POST', '/api/sources/http/test')[0]?.body).toEqual({
      url: 'https://www.annonces-automobile.com/recherche?marque=porsche',
    });
  });

  it('ajouter la page de résultats Annonces-Automobile l’enregistre dans les réglages, l’affiche dans la liste et vide le formulaire', async () => {
    // Given
    const server = serverForSitesScreen();
    await openSites(server);
    const advanced = screen.getByText('Avancé : un site sans alerte email').closest('details');
    const openBefore = advanced?.open;
    fireEvent.input(screen.getByLabelText('Nom du site'), { target: { value: 'Annonces-Automobile' } });
    fireEvent.input(screen.getByLabelText('Adresse de la page de résultats'), {
      target: { value: 'https://www.annonces-automobile.com/recherche?marque=porsche' },
    });

    // When
    fireEvent.click(screen.getByRole('button', { name: 'Ajouter ce site' }));

    // Then
    expect(await screen.findByText('Site ajouté')).toBeTruthy();
    expect(savedSettings(server).httpSites).toEqual([
      {
        id: expect.stringMatching(/^[0-9a-z]+$/),
        name: 'Annonces-Automobile',
        url: 'https://www.annonces-automobile.com/recherche?marque=porsche',
        enabled: true,
      },
    ]);
    expect(openBefore).toBe(false);
    await waitFor(() => expect(advanced?.open).toBe(true));
    expect(within(siteBlock('Annonces-Automobile')).getByText('Jamais vérifiée')).toBeTruthy();
    await waitFor(() => expect(screen.getByLabelText<HTMLInputElement>('Nom du site').value).toBe(''));
    expect(screen.getByLabelText<HTMLInputElement>('Adresse de la page de résultats').value).toBe('');
  });

  it('retirer la page Annonces-Automobile devenue inutile puis « Enregistrer les sites » l’enlève des réglages', async () => {
    // Given
    const annoncesAutomobile = {
      id: 'k3x9p2q1',
      name: 'Annonces-Automobile',
      url: 'https://www.annonces-automobile.com/recherche?marque=porsche',
      enabled: true,
    };
    const server = serverForSitesScreen(
      sitesOf({
        httpSites: [
          {
            ...annoncesAutomobile,
            lastRun: {
              source: 'http:k3x9p2q1',
              last_run_at: '2026-10-15T07:30:00.000Z',
              ok: 1,
              detail: '2 annonce(s) lue(s) (données structurées).',
            },
          },
        ],
      }),
      { ...bordeauxDealerSettings, httpSites: [annoncesAutomobile] },
    );
    await openSites(server);
    const fine = within(siteBlock('Annonces-Automobile')).getByText('Fonctionne');

    // When
    fireEvent.click(screen.getByRole('button', { name: 'Retirer' }));
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer les sites' }));

    // Then
    expect(fine.className).toBe('badge ok');
    expect(await screen.findByText('Enregistré')).toBeTruthy();
    expect(savedSettings(server).httpSites).toEqual([]);
    expect(screen.queryByRole('heading', { name: 'Annonces-Automobile' })).toBeNull();
  });

  it('un rafraîchissement de l’écran Sites qui échoue pendant le redémarrage du serveur garde l’écran affiché, sans message', async () => {
    // Given
    const server = serverForSitesScreen(sitesOf({ emails: [laCentraleSixtyOneAnnounced] }));
    const state = await openSites(server);
    server.on('GET', '/api/sources', () => json(502, null));

    // When
    act(() => state.refresh.request());

    // Then
    await waitFor(() => expect(server.requestsTo('GET', '/api/sources')).toHaveLength(2));
    await act(() => new Promise((settled) => setTimeout(settled, 20)));
    expect(screen.getByText('61 nouveaux véhicules correspondent à votre recherche')).toBeTruthy();
    expect(document.getElementById('toast')?.textContent).toBe('');
  });
});
