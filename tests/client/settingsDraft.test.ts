import { describe, expect, it } from 'vitest';
import { createApiClient } from '../../client/src/api/client';
import { createHttp } from '../../client/src/api/http';
import { createSettingsDraft } from '../../client/src/state/settingsDraft';
import type { SettingsDto, SettingsResponse } from '../../src/shared/api';
import { fakeServer, json } from './support/fakeServer';
import { heldAnswer } from './support/heldAnswer';

const family = { enabled: true, brands: [], known: [], minPrice: 0, maxYear: 0, keywords: [] };

const savedSettings: SettingsDto = {
  dealer: { firstName: 'Julien', lastName: 'Marchand', company: 'Autos du Sud-Ouest', city: 'Bordeaux', phone: '06 12 34 56 78' },
  zone: { city: 'Bordeaux', postalCode: '33000', lat: 44.84, lon: -0.58, radiusKm: 150 },
  maxKm: 100000,
  privateOnly: true,
  specialOnly: true,
  families: { allemandes: family, italiennes: family, americaines: family, francaises: family, autres: family },
  templates: {
    allemandes: { variants: ['Bonjour,'] },
    italiennes: { variants: ['Bonjour,'] },
    americaines: { variants: ['Bonjour,'] },
    francaises: { variants: ['Bonjour,'] },
    autres: { variants: ['Bonjour,'] },
  },
  notifications: { push: true, telegramToken: '', telegramChatId: '' },
  imap: { host: 'imap.gmail.com', port: 993, user: 'alertes.concession@gmail.com', pass: '••••••••', mailbox: 'INBOX' },
  httpSites: [],
  alertsDone: {},
  alerts: {},
};

const settingsResponse = (settings: SettingsDto): SettingsResponse => ({
  settings,
  variables: { modele: 'Modèle de la voiture' },
  families: [{ key: 'allemandes', label: 'Allemandes' }],
});

describe('brouillon des réglages partagé par Réglages, Messages et Sites', () => {
  it('passer de Réglages à Messages garde un kilométrage maximum changé et pas encore enregistré', async () => {
    // Given
    const server = fakeServer();
    server.on('GET', '/api/settings', () => json(200, settingsResponse(savedSettings)));
    const draft = createSettingsDraft(createApiClient(createHttp({ fetch: server.fetch, onUnauthorized: () => undefined })));
    await draft.loadUnlessDirty();
    draft.edit((settings) => ({ ...settings, maxKm: 150000 }));

    // When
    await draft.loadUnlessDirty();

    // Then
    expect(draft.draft.value?.maxKm).toBe(150000);
    expect(draft.dirty.value).toBe(true);
    expect(server.requestsTo('GET', '/api/settings')).toHaveLength(1);
  });

  it('sans changement en cours, revenir sur un écran de réglages relit ce que le serveur a, par exemple une alerte confirmée entre-temps', async () => {
    // Given
    const server = fakeServer();
    server.on('GET', '/api/settings', () => json(200, settingsResponse(savedSettings)));
    const draft = createSettingsDraft(createApiClient(createHttp({ fetch: server.fetch, onUnauthorized: () => undefined })));
    await draft.loadUnlessDirty();
    server.on('GET', '/api/settings', () => json(200, settingsResponse({ ...savedSettings, alertsDone: { leboncoin: true } })));

    // When
    await draft.loadUnlessDirty();

    // Then
    expect(draft.draft.value?.alertsDone).toEqual({ leboncoin: true });
    expect(draft.dirty.value).toBe(false);
  });

  it('un kilométrage tapé pendant que les réglages se rechargent, en revenant sur l’écran, n’est pas effacé par la réponse du serveur', async () => {
    // Given
    const server = fakeServer();
    server.on('GET', '/api/settings', () => json(200, settingsResponse(savedSettings)));
    const draft = createSettingsDraft(createApiClient(createHttp({ fetch: server.fetch, onUnauthorized: () => undefined })));
    await draft.loadUnlessDirty();
    const slowNetwork = heldAnswer();
    server.on('GET', '/api/settings', slowNetwork.answer);
    const reloading = draft.loadUnlessDirty();

    // When
    draft.edit((settings) => ({ ...settings, maxKm: 150000 }));
    slowNetwork.release(json(200, settingsResponse(savedSettings)));
    await reloading;

    // Then
    expect(draft.draft.value?.maxKm).toBe(150000);
    expect(draft.dirty.value).toBe(true);
  });

  it('enregistrer le brouillon le rend identique aux réglages du serveur : plus rien n’est en attente', async () => {
    // Given
    const server = fakeServer();
    server.on('GET', '/api/settings', () => json(200, settingsResponse(savedSettings)));
    server.on('PUT', '/api/settings', (request) => json(200, { settings: request.body, preview: { pass: 12, total: 40 }, warning: null }));
    const draft = createSettingsDraft(createApiClient(createHttp({ fetch: server.fetch, onUnauthorized: () => undefined })));
    await draft.loadUnlessDirty();
    draft.edit((settings) => ({ ...settings, zone: { ...settings.zone, radiusKm: 100 } }));

    // When
    const answer = await draft.save(draft.draft.value ?? savedSettings);

    // Then
    expect(answer.preview).toEqual({ pass: 12, total: 40 });
    expect(draft.dirty.value).toBe(false);
    expect(draft.saved.value?.settings.zone.radiusKm).toBe(100);
  });
});
