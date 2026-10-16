import { act, fireEvent, screen, waitFor, within } from '@testing-library/preact';
import { describe, expect, it } from 'vitest';
import type { AppState } from '../../client/src/state/appState';
import type { SettingsDto, SettingsPreviewDto } from '../../src/shared/api';
import { DEALER_SETTINGS, dealerSettings } from './support/dealerSettings';
import { type FakeServer, json, type RecordedRequest } from './support/fakeServer';
import { heldAnswer } from './support/heldAnswer';
import { renderedApplication, serverForSignedInDealer } from './support/testApplication';

const CITY_NOT_FOUND = 'Ville introuvable : le filtre de distance est désactivé tant que la ville n’est pas reconnue.';

const sentSettings = (request: RecordedRequest | undefined): SettingsDto => request?.body as SettingsDto;

const savedAsSent =
  (preview: SettingsPreviewDto, warning: string | null = null) =>
  (request: RecordedRequest) =>
    json(200, { settings: request.body, preview, warning });

const dealerOnSettings = (): FakeServer => {
  const server = serverForSignedInDealer();
  server.on('GET', '/api/settings', () => json(200, dealerSettings()));
  server.on('POST', '/api/settings/preview', () => json(200, { pass: 12, total: 40 }));
  return server;
};

const openSettings = async (server: FakeServer): Promise<AppState> => {
  window.location.hash = '#/reglages';
  const state = await renderedApplication(server);
  await screen.findByRole('heading', { name: 'Vous' });
  return state;
};

const goTo = (hash: string): void => {
  window.location.hash = hash;
  window.dispatchEvent(new HashChangeEvent('hashchange'));
};

const toast = (): { readonly text: string; readonly error: boolean } => {
  const shown = document.getElementById('toast');
  return { text: shown?.textContent ?? '', error: shown?.classList.contains('error') === true };
};

const saveButton = (): HTMLButtonElement => screen.getByRole('button', { name: /^Enregistr/ }) as HTMLButtonElement;

const familyBox = (label: string): HTMLElement => screen.getByRole('heading', { name: label, level: 3 }).closest('.family') as HTMLElement;

const field = (label: string): HTMLInputElement => screen.getByLabelText(label) as HTMLInputElement;

const offline = (): Promise<Response> => Promise.reject(new TypeError('Failed to fetch'));

const blurredWhenRemoved = (element: HTMLElement): void => {
  const remove = element.remove.bind(element);
  element.remove = () => {
    element.dispatchEvent(new FocusEvent('blur'));
    remove();
  };
};

describe('écran Réglages', () => {
  it('passer le rayon de 150 à 100 km autour de Bordeaux recalcule le compteur avant même d’enregistrer : « 12 annonces sur 7 jours » devient « 8 annonces sur 7 jours »', async () => {
    // Given
    const server = dealerOnSettings();
    server.on('POST', '/api/settings/preview', (request) =>
      json(200, sentSettings(request).zone.radiusKm === 100 ? { pass: 8, total: 40 } : { pass: 12, total: 40 }),
    );
    await openSettings(server);
    const beforeCount = screen.getByText('Calcul en cours…');
    expect(await screen.findByText('12 annonces sur 7 jours')).toBeTruthy();
    expect(screen.getByText('avec ces réglages, sur 40 annonces reçues')).toBeTruthy();

    // When
    fireEvent.input(field('Rayon autour de la ville'), { target: { value: '100' } });

    // Then
    expect(beforeCount).toBeTruthy();
    expect(screen.getByText('100 km')).toBeTruthy();
    expect(await screen.findByText('8 annonces sur 7 jours')).toBeTruthy();
    expect(sentSettings(server.requestsTo('POST', '/api/settings/preview').at(-1)).zone.radiusKm).toBe(100);
    expect(server.requestsTo('PUT', '/api/settings')).toHaveLength(0);
    expect(saveButton().disabled).toBe(false);
  });

  it('un compteur qui ne peut pas être recalculé, le réseau étant coupé, garde le dernier nombre affiché, sans message d’erreur', async () => {
    // Given
    const server = dealerOnSettings();
    await openSettings(server);
    await screen.findByText('12 annonces sur 7 jours');
    server.on('POST', '/api/settings/preview', offline);

    // When
    fireEvent.input(field('Kilométrage maximum'), { target: { value: '150000' } });

    // Then
    await waitFor(() => expect(server.requestsTo('POST', '/api/settings/preview')).toHaveLength(2));
    await act(() => Promise.resolve());
    expect(screen.getByText('12 annonces sur 7 jours')).toBeTruthy();
    expect(toast().text).toBe('');
  });

  it('effacer le kilométrage maximum pour taper 150 000 ne fait pas apparaître de zéro dans le champ', async () => {
    // Given
    const server = dealerOnSettings();
    await openSettings(server);
    const maxKm = field('Kilométrage maximum');

    // When
    fireEvent.input(maxKm, { target: { value: '' } });
    const whileCleared = maxKm.value;
    fireEvent.input(maxKm, { target: { value: '150000' } });

    // Then
    expect(whileCleared).toBe('');
    expect(maxKm.value).toBe('150000');
    await waitFor(() => expect(sentSettings(server.requestsTo('POST', '/api/settings/preview').at(-1)).maxKm).toBe(150000));
  });

  it('passer de Réglages à Messages garde le rayon de 100 km pas encore enregistré, et « Enregistrer » reste disponible en revenant', async () => {
    // Given
    const server = dealerOnSettings();
    await openSettings(server);
    fireEvent.input(field('Rayon autour de la ville'), { target: { value: '100' } });

    // When
    goTo('#/messages');
    await screen.findByRole('heading', { name: 'Variante 1' });
    goTo('#/reglages');
    await screen.findByRole('heading', { name: 'Vous' });

    // Then
    expect(field('Rayon autour de la ville').value).toBe('100');
    expect(screen.getByText('100 km')).toBeTruthy();
    expect(saveButton().disabled).toBe(false);
    expect(server.requestsTo('GET', '/api/settings')).toHaveLength(1);
  });

  it('sans changement en cours, revenir sur Réglages montre le téléphone enregistré entre-temps depuis l’ordinateur de la concession', async () => {
    // Given
    const server = dealerOnSettings();
    await openSettings(server);
    goTo('#/messages');
    await screen.findByRole('heading', { name: 'Variante 1' });
    const changedElsewhere = { ...DEALER_SETTINGS, dealer: { ...DEALER_SETTINGS.dealer, phone: '06 98 76 54 32' } };
    server.on('GET', '/api/settings', () => json(200, dealerSettings(changedElsewhere)));

    // When
    goTo('#/reglages');

    // Then
    await waitFor(() => expect(field('Téléphone').value).toBe('06 98 76 54 32'));
    expect(saveButton().disabled).toBe(true);
  });

  it('une notification reçue pendant que Réglages est ouvert, sans changement en cours, fait relire les réglages et recalculer le compteur', async () => {
    // Given
    const server = dealerOnSettings();
    const state = await openSettings(server);
    await screen.findByText('12 annonces sur 7 jours');
    server.on('POST', '/api/settings/preview', () => json(200, { pass: 13, total: 41 }));

    // When
    act(() => state.refresh.request());

    // Then
    expect(await screen.findByText('13 annonces sur 7 jours')).toBeTruthy();
    expect(server.requestsTo('GET', '/api/settings')).toHaveLength(2);
  });

  it('enregistrer le nouveau numéro de la concession : « Enregistrement… » pendant l’envoi, puis « Réglages enregistrés »', async () => {
    // Given
    const server = dealerOnSettings();
    const slowNetwork = heldAnswer();
    server.on('PUT', '/api/settings', slowNetwork.answer);
    await openSettings(server);
    fireEvent.input(field('Téléphone'), { target: { value: '05 56 00 12 34' } });

    // When
    fireEvent.click(saveButton());
    const whileSaving = { text: saveButton().textContent, disabled: saveButton().disabled };
    slowNetwork.release(
      json(200, {
        settings: { ...DEALER_SETTINGS, dealer: { ...DEALER_SETTINGS.dealer, phone: '05 56 00 12 34' } },
        preview: { pass: 12, total: 40 },
        warning: null,
      }),
    );

    // Then
    expect(whileSaving).toEqual({ text: 'Enregistrement…', disabled: true });
    await waitFor(() => expect(toast()).toEqual({ text: 'Réglages enregistrés', error: false }));
    expect(sentSettings(server.requestsTo('PUT', '/api/settings')[0]).dealer.phone).toBe('05 56 00 12 34');
    expect(saveButton().textContent).toBe('Enregistrer');
    expect(saveButton().disabled).toBe(true);
  });

  it('enregistrer une zone à Saint-Émilion, ville introuvable, affiche l’avertissement en rouge à la place de « Réglages enregistrés »', async () => {
    // Given
    const server = dealerOnSettings();
    server.on('PUT', '/api/settings', savedAsSent({ pass: 31, total: 40 }, CITY_NOT_FOUND));
    await openSettings(server);
    fireEvent.input(field('Ville de référence'), { target: { value: 'Saint-Émilion' } });
    fireEvent.input(field('Code postal (facultatif)'), { target: { value: '' } });

    // When
    fireEvent.click(saveButton());

    // Then
    await waitFor(() => expect(toast()).toEqual({ text: CITY_NOT_FOUND, error: true }));
    expect(screen.getByText('31 annonces sur 7 jours')).toBeTruthy();
    expect(sentSettings(server.requestsTo('PUT', '/api/settings')[0]).zone).toMatchObject({ city: 'Saint-Émilion', postalCode: '' });
    expect(saveButton().disabled).toBe(true);
  });

  it('un enregistrement refusé parce que la ville de la zone a été effacée affiche la raison du serveur et laisse « Enregistrer » disponible', async () => {
    // Given
    const server = dealerOnSettings();
    server.on('PUT', '/api/settings', () => json(400, { error: 'Indiquez la ville de la zone.' }));
    await openSettings(server);
    fireEvent.input(field('Ville de référence'), { target: { value: '' } });

    // When
    fireEvent.click(saveButton());

    // Then
    await waitFor(() => expect(toast()).toEqual({ text: 'Indiquez la ville de la zone.', error: true }));
    expect(saveButton().textContent).toBe('Enregistrer');
    expect(saveButton().disabled).toBe(false);
  });

  it('Réglages ouverts sans réseau : la raison s’affiche et l’écran garde son titre', async () => {
    // Given
    const server = serverForSignedInDealer();
    server.on('GET', '/api/settings', offline);
    window.location.hash = '#/reglages';

    // When
    await renderedApplication(server);

    // Then
    await waitFor(() => expect(toast()).toEqual({ text: 'Failed to fetch', error: true }));
    expect(screen.getByRole('heading', { name: 'Réglages' })).toBeTruthy();
    expect(screen.queryByRole('heading', { name: 'Vous' })).toBeNull();
  });

  it('chez les allemandes, toucher Audi la décoche et « Ajouter une marque » ajoute Brabus déjà cochée ; l’enregistrement envoie les deux', async () => {
    // Given
    const server = dealerOnSettings();
    server.on('PUT', '/api/settings', savedAsSent({ pass: 11, total: 40 }));
    await openSettings(server);
    const germans = familyBox('Allemandes');

    // When
    fireEvent.click(within(germans).getByRole('button', { name: 'Audi' }));
    fireEvent.click(within(germans).getByRole('button', { name: '+ Ajouter une marque' }));
    const brand = within(germans).getByPlaceholderText('Ajouter une marque');
    fireEvent.input(brand, { target: { value: 'Brabus ' } });
    fireEvent.keyDown(brand, { key: 'Enter' });
    fireEvent.click(saveButton());

    // Then
    expect(within(germans).getByRole('button', { name: 'Audi' }).getAttribute('aria-pressed')).toBe('false');
    expect(within(germans).getByRole('button', { name: 'Brabus' }).getAttribute('aria-pressed')).toBe('true');
    expect(within(germans).getByRole('button', { name: '+ Ajouter une marque' })).toBeTruthy();
    await waitFor(() => expect(server.requestsTo('PUT', '/api/settings')).toHaveLength(1));
    const germanRules = sentSettings(server.requestsTo('PUT', '/api/settings')[0]).families.allemandes;
    expect(germanRules.brands).toEqual(['Porsche', 'Mercedes-Benz', 'BMW', 'Alpina', 'Brabus']);
    expect(germanRules.known).toContain('Brabus');
  });

  it('ajouter le mot-clé « GT3 RS » chez les allemandes en touchant ailleurs, puis retirer « RS6 » par sa croix', async () => {
    // Given
    const server = dealerOnSettings();
    await openSettings(server);
    const germans = familyBox('Allemandes');

    // When
    fireEvent.click(within(germans).getByRole('button', { name: '+ Ajouter un mot-clé' }));
    const keyword = within(germans).getByPlaceholderText('Ajouter un mot-clé');
    fireEvent.input(keyword, { target: { value: 'GT3 RS' } });
    fireEvent.blur(keyword);
    fireEvent.click(within(within(germans).getByRole('button', { name: /^RS6/ })).getByTitle('Retirer'));

    // Then
    const keywords = within(germans).getByText('Ou modèles et mots-clés').closest('.field')?.querySelectorAll('.chip:not(.add)');
    expect([...(keywords ?? [])].map((chip) => chip.firstChild?.textContent)).toEqual(['911', 'GT3', 'AMG', 'M3', 'GT3 RS']);
    expect(saveButton().disabled).toBe(false);
  });

  it('Échap abandonne un mot-clé commencé par erreur, même quand le navigateur signale la sortie du champ au moment où il se ferme', async () => {
    // Given
    const server = dealerOnSettings();
    await openSettings(server);
    const italians = familyBox('Italiennes');
    fireEvent.click(within(italians).getByRole('button', { name: '+ Ajouter un mot-clé' }));
    const keyword = within(italians).getByPlaceholderText('Ajouter un mot-clé');
    fireEvent.input(keyword, { target: { value: 'Testarossa' } });
    blurredWhenRemoved(keyword);

    // When
    fireEvent.keyDown(keyword, { key: 'Escape' });

    // Then
    expect(within(italians).queryByRole('button', { name: /Testarossa/ })).toBeNull();
    expect(within(italians).getByRole('button', { name: '+ Ajouter un mot-clé' })).toBeTruthy();
    expect(saveButton().disabled).toBe(true);
  });

  it('désactiver « Supercar et collection uniquement » masque la règle de chaque famille, mais pas les réglages Telegram', async () => {
    // Given
    const server = dealerOnSettings();
    await openSettings(server);
    const specialOnly = screen.getByRole('switch', { name: /Supercar et collection uniquement/ });

    // When
    fireEvent.click(screen.getByText('Supercar et collection uniquement'));

    // Then
    expect(specialOnly.getAttribute('aria-checked')).toBe('false');
    const rules = screen.getAllByText('Règle supercar et collection').map((summary) => summary.closest('details'));
    expect(rules.map((details) => details?.classList.contains('hidden'))).toEqual([true, true, true, true]);
    expect(screen.getByText('Telegram (facultatif)').closest('details')?.classList.contains('hidden')).toBe(false);
    await waitFor(() => expect(sentSettings(server.requestsTo('POST', '/api/settings/preview').at(-1)).specialOnly).toBe(false));
  });

  it('couper la famille des américaines replie ses marques', async () => {
    // Given
    const server = dealerOnSettings();
    await openSettings(server);
    const americans = familyBox('Américaines');

    // When
    fireEvent.click(within(americans).getByRole('switch'));

    // Then
    expect(americans.getAttribute('data-enabled')).toBe('false');
    expect(within(americans).getByRole('switch').getAttribute('aria-checked')).toBe('false');
    await waitFor(() =>
      expect(sentSettings(server.requestsTo('POST', '/api/settings/preview').at(-1)).families.americaines.enabled).toBe(false),
    );
  });

  it('« Envoyer un test Telegram » essaie le jeton et l’identifiant tout juste saisis, avant même l’enregistrement', async () => {
    // Given
    const server = dealerOnSettings();
    server.on('POST', '/api/telegram/test', () => json(200, { ok: true, detail: 'Message envoyé sur Telegram.' }));
    await openSettings(server);
    fireEvent.click(screen.getByText('Telegram (facultatif)'));
    fireEvent.input(field('Jeton du bot'), { target: { value: '7012345678:AAHdqTcvCH1vGWJxfSeofSAs0K5PALDsaw' } });
    fireEvent.input(field('Identifiant de conversation'), { target: { value: '512345678' } });

    // When
    fireEvent.click(screen.getByRole('button', { name: 'Envoyer un test Telegram' }));

    // Then
    await waitFor(() => expect(toast()).toEqual({ text: 'Message envoyé sur Telegram.', error: false }));
    expect(server.requestsTo('POST', '/api/telegram/test')[0]?.body).toEqual({
      token: '7012345678:AAHdqTcvCH1vGWJxfSeofSAs0K5PALDsaw',
      chatId: '512345678',
    });
    expect(server.requestsTo('PUT', '/api/settings')).toHaveLength(0);
  });

  it('« Envoyer un test » alors qu’aucun appareil n’est abonné affiche la raison en rouge', async () => {
    // Given
    const server = dealerOnSettings();
    const noDevice = 'Aucun appareil abonné : activez les notifications sur ce téléphone ou cet ordinateur.';
    server.on('POST', '/api/push/test', () => json(200, { ok: false, detail: noDevice }));
    await openSettings(server);

    // When
    fireEvent.click(screen.getByRole('button', { name: 'Envoyer un test' }));

    // Then
    await waitFor(() => expect(toast()).toEqual({ text: noDevice, error: true }));
  });

  it('sur un iPhone où l’application n’est pas encore sur l’écran d’accueil, « Activer sur cet appareil » explique qu’il faut d’abord l’y ajouter', async () => {
    // Given
    const server = dealerOnSettings();
    await openSettings(server);

    // When
    fireEvent.click(screen.getByRole('button', { name: 'Activer sur cet appareil' }));

    // Then
    await waitFor(() =>
      expect(toast()).toEqual({
        text: 'Ce navigateur ne gère pas les notifications. Sur iPhone, ajoutez d’abord l’application à l’écran d’accueil.',
        error: true,
      }),
    );
    expect(screen.getByText('Non prises en charge par ce navigateur.')).toBeTruthy();
  });

  it('dans Affichage, « Sombre » passe l’application en sombre sur cet appareil, puis « Comme l’appareil » rend la main au téléphone', async () => {
    // Given
    const server = dealerOnSettings();
    await openSettings(server);

    // When
    const theme = within(screen.getByRole('toolbar', { name: 'Thème' }));
    fireEvent.click(theme.getByRole('button', { name: 'Sombre' }));
    const dark = {
      theme: document.documentElement.getAttribute('data-theme'),
      stored: window.localStorage.getItem('av_theme'),
      pressed: screen.getByRole('button', { name: 'Sombre' }).getAttribute('aria-pressed'),
      topButton: screen.queryByRole('button', { name: 'Passer en mode clair' }) !== null,
    };
    fireEvent.click(theme.getByRole('button', { name: 'Comme l’appareil' }));

    // Then
    expect(dark).toEqual({ theme: 'dark', stored: 'dark', pressed: 'true', topButton: true });
    expect(document.documentElement.hasAttribute('data-theme')).toBe(false);
    expect(window.localStorage.getItem('av_theme')).toBe('auto');
    expect(screen.getByRole('button', { name: 'Comme l’appareil' }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('button', { name: 'Sombre' }).getAttribute('aria-pressed')).toBe('false');
  });
});
