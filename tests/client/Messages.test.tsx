import { act, fireEvent, screen, waitFor, within } from '@testing-library/preact';
import { describe, expect, it } from 'vitest';
import type { SettingsDto, TemplatePreviewRequest } from '../../src/shared/api';
import { DEALER_SETTINGS, dealerSettings } from './support/dealerSettings';
import { type FakeServer, json, type RecordedRequest } from './support/fakeServer';
import { renderedApplication, serverForSignedInDealer } from './support/testApplication';

const LONG_DASH_WARNING = 'Contient un tiret long (— ou –) : à remplacer par une virgule ou un point.';

const RENDERED_ON_THE_911 =
  'Bonjour,\n\nJe viens de tomber sur votre 911 Carrera S 2015 sur Leboncoin. Je suis Julien, je tiens Autos du Sud-Ouest à Bordeaux.';

const previewRequest = (request: RecordedRequest | undefined): TemplatePreviewRequest => request?.body as TemplatePreviewRequest;

const renderedOn911 = (request: RecordedRequest) => {
  const { text = '' } = previewRequest(request);
  return json(200, { text: `${RENDERED_ON_THE_911}\n${text.length} caractères`, warnings: text.includes('—') ? [LONG_DASH_WARNING] : [] });
};

const dealerOnMessages = (): FakeServer => {
  const server = serverForSignedInDealer();
  server.on('GET', '/api/settings', () => json(200, dealerSettings()));
  server.on('POST', '/api/settings/preview', () => json(200, { pass: 12, total: 40 }));
  server.on('POST', '/api/templates/preview', renderedOn911);
  return server;
};

const openMessages = async (server: FakeServer): Promise<void> => {
  window.location.hash = '#/messages';
  await renderedApplication(server);
  await screen.findByRole('heading', { name: 'Variante 1' });
};

const goTo = (hash: string): void => {
  window.location.hash = hash;
  window.dispatchEvent(new HashChangeEvent('hashchange'));
};

const variant = (number: number): HTMLElement =>
  screen.getByRole('heading', { name: `Variante ${number}` }).closest('.variant') as HTMLElement;

const variantText = (number: number): HTMLTextAreaElement => variant(number).querySelector('textarea') as HTMLTextAreaElement;

const variantPreview = (number: number): string => variant(number).querySelector('.preview')?.textContent ?? '';

const toast = (): { readonly text: string; readonly error: boolean } => {
  const shown = document.getElementById('toast');
  return { text: shown?.textContent ?? '', error: shown?.classList.contains('error') === true };
};

const saveButton = (): HTMLButtonElement => screen.getByRole('button', { name: 'Enregistrer' }) as HTMLButtonElement;

const sentSettings = (request: RecordedRequest | undefined): SettingsDto => request?.body as SettingsDto;

const offline = (): Promise<Response> => Promise.reject(new TypeError('Failed to fetch'));

describe('écran Messages', () => {
  it('une variante où un tiret long s’est glissé : l’aperçu montre le message rendu sur une annonce et l’avertissement du vérificateur', async () => {
    // Given
    const server = dealerOnMessages();
    await openMessages(server);
    const withDash = `${DEALER_SETTINGS.templates.allemandes.variants[0]} — à bientôt.`;

    // When
    fireEvent.input(variantText(1), { target: { value: withDash } });

    // Then
    expect(await within(variant(1)).findByText(LONG_DASH_WARNING)).toBeTruthy();
    expect(within(variant(1)).getByText(LONG_DASH_WARNING).className).toBe('note warn');
    expect(variantPreview(1)).toBe(`${RENDERED_ON_THE_911}\n${withDash.length} caractères`);
    expect(previewRequest(server.requestsTo('POST', '/api/templates/preview').at(-1))).toEqual({ family: 'allemandes', text: withDash });
    expect(within(variant(2)).queryByText(LONG_DASH_WARNING)).toBeNull();
  });

  it('un aperçu de message en échec, le réseau étant coupé, n’empêche pas de continuer à écrire', async () => {
    // Given
    const server = dealerOnMessages();
    await openMessages(server);
    const firstVariant = DEALER_SETTINGS.templates.allemandes.variants[0] ?? '';
    const previewBefore = `${RENDERED_ON_THE_911}\n${firstVariant.length} caractères`;
    await waitFor(() => expect(variantPreview(1)).toBe(previewBefore));
    server.on('POST', '/api/templates/preview', offline);
    const firstDraft = `${firstVariant}\nPS : je peux passer la voir`;

    // When
    fireEvent.input(variantText(1), { target: { value: firstDraft } });
    await waitFor(() => expect(previewRequest(server.requestsTo('POST', '/api/templates/preview').at(-1)).text).toBe(firstDraft));
    await act(() => new Promise((settled) => setTimeout(settled, 0)));
    const afterFailure = { preview: variantPreview(1), toast: toast().text };
    server.on('POST', '/api/templates/preview', renderedOn911);
    const finished = `${firstDraft} cette semaine.`;
    fireEvent.input(variantText(1), { target: { value: finished } });

    // Then
    expect(afterFailure).toEqual({ preview: previewBefore, toast: '' });
    await waitFor(() => expect(variantPreview(1)).toBe(`${RENDERED_ON_THE_911}\n${finished.length} caractères`));
    expect(variantText(1).value).toBe(finished);
    expect(toast().text).toBe('');
    expect(saveButton().disabled).toBe(false);
  });

  it('supprimer la première des deux variantes des allemandes : l’aperçu qui reste est recalculé pour la variante gardée, sans montrer un instant celui de la variante supprimée', async () => {
    // Given
    const server = dealerOnMessages();
    await openMessages(server);
    const [first = '', kept = ''] = DEALER_SETTINGS.templates.allemandes.variants;
    await waitFor(() => expect(variantPreview(1)).toBe(`${RENDERED_ON_THE_911}\n${first.length} caractères`));
    await waitFor(() => expect(variantPreview(2)).toBe(`${RENDERED_ON_THE_911}\n${kept.length} caractères`));

    // When
    fireEvent.click(within(variant(1)).getByRole('button', { name: 'Supprimer' }));

    // Then
    expect(variantText(1).value).toBe(kept);
    expect(variantPreview(1)).toBe('…');
    await waitFor(() => expect(variantPreview(1)).toBe(`${RENDERED_ON_THE_911}\n${kept.length} caractères`));
    expect(screen.queryByRole('heading', { name: 'Variante 2' })).toBeNull();
  });

  it('toucher {telephone} l’insère là où se trouve le curseur dans la variante', async () => {
    // Given
    const server = dealerOnMessages();
    await openMessages(server);
    const text = variantText(1);
    fireEvent.input(text, { target: { value: 'Bonjour,\n\nMon numéro : .' } });
    const beforeTheFullStop = text.value.length - 1;
    text.setSelectionRange(beforeTheFullStop, beforeTheFullStop);

    // When
    fireEvent.click(within(variant(1)).getByRole('button', { name: '{telephone}' }));

    // Then
    expect(text.value).toBe('Bonjour,\n\nMon numéro : {telephone}.');
    expect(text.selectionStart).toBe(beforeTheFullStop + '{telephone}'.length);
    expect(within(variant(1)).getByRole('button', { name: '{telephone}' }).title).toBe('votre téléphone');
    await waitFor(() =>
      expect(previewRequest(server.requestsTo('POST', '/api/templates/preview').at(-1)).text).toBe('Bonjour,\n\nMon numéro : {telephone}.'),
    );
    expect(saveButton().disabled).toBe(false);
  });

  it('toucher {telephone} sans avoir d’abord placé le curseur dans la variante l’insère au tout début, comme avant la refonte', async () => {
    // Given
    const server = dealerOnMessages();
    await openMessages(server);
    const text = variantText(1);
    const written = text.value;

    // When
    fireEvent.click(within(variant(1)).getByRole('button', { name: '{telephone}' }));

    // Then
    expect(text.value).toBe(`{telephone}${written}`);
  });

  it('chez les italiennes, « + Ajouter une variante » reprend le texte de la première ; la supprimer revient à une seule variante, sans bouton « Supprimer »', async () => {
    // Given
    const server = dealerOnMessages();
    await openMessages(server);
    fireEvent.click(screen.getByRole('button', { name: 'Italiennes' }));
    const alone = screen.queryAllByRole('button', { name: 'Supprimer' }).length;

    // When
    fireEvent.click(screen.getByRole('button', { name: '+ Ajouter une variante' }));
    const added = { text: variantText(2).value, removable: screen.getAllByRole('button', { name: 'Supprimer' }).length };
    fireEvent.click(within(variant(2)).getByRole('button', { name: 'Supprimer' }));

    // Then
    expect(alone).toBe(0);
    expect(added).toEqual({ text: DEALER_SETTINGS.templates.italiennes.variants[0], removable: 2 });
    expect(screen.queryByRole('heading', { name: 'Variante 2' })).toBeNull();
    expect(screen.queryAllByRole('button', { name: 'Supprimer' })).toHaveLength(0);
    expect(saveButton().disabled).toBe(true);
  });

  it('l’onglet Italiennes reste choisi en revenant sur Messages après un passage par Réglages', async () => {
    // Given
    const server = dealerOnMessages();
    await openMessages(server);
    fireEvent.click(screen.getByRole('button', { name: 'Italiennes' }));

    // When
    goTo('#/reglages');
    await screen.findByRole('heading', { name: 'Vous' });
    goTo('#/messages');
    await screen.findByRole('heading', { name: 'Variante 1' });

    // Then
    expect(screen.getByRole('button', { name: 'Italiennes' }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('button', { name: 'Allemandes' }).getAttribute('aria-pressed')).toBe('false');
    expect(variantText(1).value).toBe(DEALER_SETTINGS.templates.italiennes.variants[0]);
    await waitFor(() => expect(previewRequest(server.requestsTo('POST', '/api/templates/preview').at(-1)).family).toBe('italiennes'));
  });

  it('enregistrer une variante retouchée : « Messages enregistrés », et « Enregistrer » redevient indisponible', async () => {
    // Given
    const server = dealerOnMessages();
    server.on('PUT', '/api/settings', (request) => json(200, { settings: request.body, preview: { pass: 12, total: 40 }, warning: null }));
    await openMessages(server);
    const shorter = DEALER_SETTINGS.templates.allemandes.variants[1]?.replace('Bonjour,', 'Bonsoir,') ?? '';
    fireEvent.input(variantText(2), { target: { value: shorter } });

    // When
    fireEvent.click(saveButton());

    // Then
    await waitFor(() => expect(toast()).toEqual({ text: 'Messages enregistrés', error: false }));
    expect(sentSettings(server.requestsTo('PUT', '/api/settings')[0]).templates.allemandes.variants).toEqual([
      DEALER_SETTINGS.templates.allemandes.variants[0],
      shorter,
    ]);
    expect(saveButton().disabled).toBe(true);
  });

  it('un enregistrement des messages pendant la mise à jour du serveur (502) affiche l’erreur et garde « Enregistrer » disponible', async () => {
    // Given
    const server = dealerOnMessages();
    server.on('PUT', '/api/settings', () => new Response('<html>502 Bad Gateway</html>', { status: 502 }));
    await openMessages(server);
    fireEvent.input(variantText(1), { target: { value: 'Bonjour,\n\nVotre {modele} m’intéresse. {telephone}' } });

    // When
    fireEvent.click(saveButton());

    // Then
    await waitFor(() => expect(toast()).toEqual({ text: 'Erreur 502', error: true }));
    expect(saveButton().disabled).toBe(false);
  });

  it('une variante retouchée dans Messages reste en attente dans Réglages, dont « Enregistrer » l’envoie avec le reste des réglages', async () => {
    // Given
    const server = dealerOnMessages();
    server.on('PUT', '/api/settings', (request) => json(200, { settings: request.body, preview: { pass: 12, total: 40 }, warning: null }));
    await openMessages(server);
    const retouched = `${DEALER_SETTINGS.templates.allemandes.variants[0]}\nPS : reprise possible sous 48 h.`;
    fireEvent.input(variantText(1), { target: { value: retouched } });

    // When
    goTo('#/reglages');
    await screen.findByRole('heading', { name: 'Vous' });
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }));

    // Then
    await waitFor(() => expect(toast()).toEqual({ text: 'Réglages enregistrés', error: false }));
    expect(sentSettings(server.requestsTo('PUT', '/api/settings')[0]).templates.allemandes.variants[0]).toBe(retouched);
    expect(server.requestsTo('GET', '/api/settings')).toHaveLength(1);
  });
});
