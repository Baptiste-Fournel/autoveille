import { fireEvent, render, screen, waitFor, within } from '@testing-library/preact';
import { describe, expect, it, onTestFinished } from 'vitest';
import { AppContext } from '../../client/src/app/AppContext';
import { SetupCard } from '../../client/src/components/SetupCard';
import { Toast } from '../../client/src/components/Toast';
import type { AppState } from '../../client/src/state/appState';
import type { OverviewResponse } from '../../src/shared/api';
import { fakeServer, json } from './support/fakeServer';
import { applicationState } from './support/testApplication';
import { overviewWith } from './support/vehicles';

const PUSH_KEY = 'BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QTpQtUbVlUls0VJXg7A8u-Ts1XbjhazAkj7I99e8QcYP7DkM';

const phoneSubscription = {
  endpoint: 'https://fcm.googleapis.com/fcm/send/eV1x2Qk3Rk8:APA91bH',
  expirationTime: null,
  keys: { p256dh: 'BOr6pXzQm3v9Yk2Lq8Wd', auth: 'k2Lq8WdT4nRz' },
};

const phoneWithNotifications = (): void => {
  Object.defineProperty(window, 'Notification', {
    value: { permission: 'default', requestPermission: async () => 'granted' },
    configurable: true,
  });
  Object.defineProperty(window, 'PushManager', { value: () => undefined, configurable: true });
  const registration = {
    pushManager: { getSubscription: async () => null, subscribe: async () => ({ toJSON: () => phoneSubscription }) },
  };
  Object.defineProperty(window.navigator, 'serviceWorker', {
    value: { ready: Promise.resolve(registration), getRegistration: async () => registration },
    configurable: true,
  });
  onTestFinished(() => {
    Reflect.deleteProperty(window, 'Notification');
    Reflect.deleteProperty(window, 'PushManager');
    Reflect.deleteProperty(window.navigator, 'serviceWorker');
  });
};

const shownCard = (state: AppState, overview: OverviewResponse) =>
  render(
    <AppContext.Provider value={state}>
      <SetupCard overview={overview} />
      <Toast />
    </AppContext.Provider>,
  );

const stepOf = (label: string): HTMLElement => {
  const step = screen.getByText(label).closest('li');
  if (step === null) {
    throw new Error(`Étape ${label} absente`);
  }
  return step;
};

describe('carte Mise en route', () => {
  it('un concessionnaire qui a donné son nom et son téléphone, sur un navigateur sans notifications, voit « Mise en route 1/3 » et chaque étape restante mène à l’écran où elle se fait', () => {
    // Given
    const state = applicationState(fakeServer());
    const overview = { ...overviewWith(), imapConfigured: false, alertsDone: ['leboncoin', 'largus'] };

    // When
    shownCard(state, overview);

    // Then
    expect(screen.getByRole('heading', { name: 'Mise en route 1/3' })).toBeTruthy();
    expect(stepOf('Votre nom et votre téléphone').className).toBe('done');
    expect(within(stepOf('Votre nom et votre téléphone')).queryByRole('link')).toBeNull();
    expect(within(stepOf('La boîte mail des alertes')).getByRole('link', { name: 'Sites' }).getAttribute('href')).toBe('#/sources');
    expect(within(stepOf('Les alertes sur les sites (1/4)')).getByRole('link', { name: 'Sites' }).getAttribute('href')).toBe('#/sources');
    expect(screen.queryByText('Les notifications sur cet appareil')).toBeNull();
  });

  it('sans prénom ni téléphone dans les réglages, la première étape mène à Réglages', () => {
    // Given
    const state = applicationState(fakeServer());
    const overview = overviewWith();
    const newcomer = { ...overview, dealer: { ...overview.dealer, firstName: '', phone: '' } };

    // When
    shownCard(state, newcomer);

    // Then
    expect(screen.getByRole('heading', { name: 'Mise en route 2/3' })).toBeTruthy();
    expect(within(stepOf('Votre nom et votre téléphone')).getByRole('link', { name: 'Réglages' }).getAttribute('href')).toBe('#/reglages');
  });

  it('sur le téléphone, « Activer » dans la carte abonne cet appareil aux notifications, et la carte disparaît une fois les quatre étapes faites', async () => {
    // Given
    phoneWithNotifications();
    const server = fakeServer();
    server.on('GET', '/api/push/key', () => json(200, { key: PUSH_KEY }));
    server.on('POST', '/api/push/subscribe', () => json(200, { ok: true, count: 1 }));
    const state = applicationState(server);
    shownCard(state, overviewWith());
    expect(screen.getByRole('heading', { name: 'Mise en route 3/4' })).toBeTruthy();

    // When
    fireEvent.click(within(stepOf('Les notifications sur cet appareil')).getByRole('button', { name: 'Activer' }));

    // Then
    expect(await screen.findByText('Notifications activées sur cet appareil.')).toBeTruthy();
    await waitFor(() => expect(screen.queryByText(/Mise en route/)).toBeNull());
    expect(server.requestsTo('POST', '/api/push/subscribe')[0]?.body).toEqual({ subscription: phoneSubscription });
  });

  it('« Masquer » retire la carte de ce téléphone : elle ne revient pas au prochain affichage de la liste', () => {
    // Given
    const state = applicationState(fakeServer());
    const overview = { ...overviewWith(), imapConfigured: false };
    const first = shownCard(state, overview);

    // When
    fireEvent.click(screen.getByRole('button', { name: 'Masquer' }));
    const afterHiding = screen.queryByText(/Mise en route/);
    first.unmount();
    shownCard(state, overview);

    // Then
    expect(afterHiding).toBeNull();
    expect(screen.queryByText(/Mise en route/)).toBeNull();
    expect(window.localStorage.getItem('av_setup_hidden')).toBe('1');
  });

  it('la carte masquée sur ce téléphone avant la mise à jour de l’application reste masquée', () => {
    // Given
    window.localStorage.setItem('av_setup_hidden', '1');
    const state = applicationState(fakeServer());

    // When
    shownCard(state, { ...overviewWith(), imapConfigured: false });

    // Then
    expect(screen.queryByText(/Mise en route/)).toBeNull();
  });
});
