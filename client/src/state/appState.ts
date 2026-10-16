import { effect, type Signal, signal, untracked } from '@preact/signals';
import type { Family, MeResponse } from '../../../src/shared/api';
import { type ApiClient, createApiClient } from '../api/client';
import { createHttp } from '../api/http';
import type { Route } from '../app/route';
import { createRouter, type Router } from '../app/router';
import { createPush, type Push } from '../push/push';
import { type DevicePreferences, devicePreferences } from '../storage/preferences';
import { createTheme, type Theme } from '../theme/theme';
import type { BurstProgress } from './burst';
import { createOverview, type Overview } from './overview';
import { createRefresh, type Refresh } from './refresh';
import { createSession, type Session, signedOut } from './session';
import { createSettingsDraft, type SettingsDraft } from './settingsDraft';
import { createToast, type Toast } from './toast';
import { createVehicleChanges, type VehicleChanges } from './vehicleChanges';
import { createVehicleLists, type VehicleLists } from './vehicleLists';
import { createVehicleSheet, type VehicleSheet } from './vehicleSheet';

export interface AppEnvironment {
  readonly fetch: typeof fetch;
  readonly window: Window & typeof globalThis;
}

export interface AppState {
  readonly api: ApiClient;
  readonly preferences: DevicePreferences;
  readonly router: Router;
  readonly session: Session;
  readonly overview: Overview;
  readonly vehicles: VehicleLists;
  readonly sheet: VehicleSheet;
  readonly changes: VehicleChanges;
  readonly settings: SettingsDraft;
  readonly toast: Toast;
  readonly theme: Theme;
  readonly push: Push;
  readonly refresh: Refresh;
  readonly pendingConfirmation: Signal<number | null>;
  readonly burst: Signal<BurstProgress | null>;
  readonly messagesFamily: Signal<Family | null>;
  readonly stop: () => void;
}

export const createAppState = ({ fetch, window }: AppEnvironment): AppState => {
  const preferences = devicePreferences(() => window.localStorage);
  const toast = createToast();
  const router = createRouter(window);
  const refresh = createRefresh(() => Date.now());
  const me = signal<MeResponse | null>(null);
  const api = createApiClient(
    createHttp({
      fetch,
      onUnauthorized: (needsSetup) => {
        me.value = signedOut(needsSetup);
      },
    }),
  );
  const session = createSession({ me, api, navigate: router.navigate });
  const overview = createOverview(api);
  const vehicles = createVehicleLists({ api, showError: (text) => toast.show(text, { error: true }) });
  const sheet = createVehicleSheet({ api, cached: vehicles.find });
  const pendingConfirmation = signal<number | null>(null);
  const changes = createVehicleChanges({ api, lists: vehicles, sheet, overview, toast, pendingConfirmation, clock: () => Date.now() });
  const theme = createTheme({
    document: window.document,
    matchMedia: typeof window.matchMedia === 'function' ? (query) => window.matchMedia(query) : undefined,
    preferences,
  });

  const enter = (route: Route): void => {
    refresh.touch();
    if (route.name === 'annonces') {
      void overview.refresh();
      void vehicles.revalidate();
    }
    if (route.name === 'annonce') {
      void sheet.open(route.id);
    }
  };

  const reload = (route: Route): void => {
    if (route.name === 'annonces') {
      void overview.refresh();
      void vehicles.revalidate();
    }
    if (route.name === 'annonce') {
      void sheet.reload();
    }
  };

  const stopEntering = effect(() => {
    const signedIn = me.value?.authenticated === true;
    const route = router.route.value;
    untracked(() => {
      if (signedIn) {
        enter(route);
      }
    });
  });
  const stopReloading = refresh.subscribe(() => {
    if (me.value?.authenticated === true) {
      reload(router.route.value);
    }
  });

  return {
    api,
    preferences,
    router,
    session,
    overview,
    vehicles,
    sheet,
    changes,
    settings: createSettingsDraft(api),
    toast,
    theme,
    push: createPush({ api, window, toast }),
    refresh,
    pendingConfirmation,
    burst: signal<BurstProgress | null>(null),
    messagesFamily: signal<Family | null>(null),
    stop: () => {
      stopEntering();
      stopReloading();
      router.stop();
      theme.stop();
    },
  };
};
