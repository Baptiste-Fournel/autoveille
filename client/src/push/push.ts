import { type ReadonlySignal, signal } from '@preact/signals';
import type { ApiClient } from '../api/client';
import { errorText } from '../api/errorText';
import type { Toast } from '../state/toast';
import { applicationServerKeyOf } from './applicationServerKey';
import { subscriptionDtoOf } from './subscriptionDto';

export type PushStatus = 'inconnu' | 'active' | 'inactive';

const UNSUPPORTED_TEXT = 'Non prises en charge par ce navigateur.';

const DENIED_TEXT = 'Refusées dans les réglages du navigateur.';

const ACTIVE_TEXT = 'Activées sur cet appareil.';

const INACTIVE_TEXT = 'Pas encore activées sur cet appareil.';

const NO_PUSH_TEXT = 'Ce navigateur ne gère pas les notifications. Sur iPhone, ajoutez d’abord l’application à l’écran d’accueil.';

const REFUSED_TEXT = 'Notifications refusées.';

const ENABLED_TEXT = 'Notifications activées sur cet appareil.';

export interface Push {
  readonly status: ReadonlySignal<PushStatus>;
  readonly possible: boolean;
  readonly statusText: () => string;
  readonly check: () => Promise<void>;
  readonly enable: () => Promise<void>;
}

export interface PushDependencies {
  readonly api: ApiClient;
  readonly window: Window & typeof globalThis;
  readonly toast: Pick<Toast, 'show'>;
}

export const createPush = ({ api, window, toast }: PushDependencies): Push => {
  const { navigator } = window;
  const status = signal<PushStatus>('inconnu');
  const possible = 'Notification' in window && 'serviceWorker' in navigator;

  const subscribe = async (): Promise<void> => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      throw new Error(NO_PUSH_TEXT);
    }
    const permission = await window.Notification.requestPermission();
    if (permission !== 'granted') {
      throw new Error(REFUSED_TEXT);
    }
    const registration = await navigator.serviceWorker.ready;
    const { key } = await api.pushKey();
    const subscription =
      (await registration.pushManager.getSubscription()) ??
      (await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: applicationServerKeyOf(key ?? '') }));
    await api.subscribePush({ subscription: subscriptionDtoOf(subscription.toJSON()) });
  };

  return {
    status,
    possible,
    statusText: () => {
      const current = status.value;
      if (!possible) {
        return UNSUPPORTED_TEXT;
      }
      if (window.Notification.permission === 'denied') {
        return DENIED_TEXT;
      }
      return current === 'active' ? ACTIVE_TEXT : INACTIVE_TEXT;
    },
    check: async () => {
      if (!('serviceWorker' in navigator)) {
        return;
      }
      try {
        const registration = await navigator.serviceWorker.getRegistration();
        const subscription = await registration?.pushManager?.getSubscription();
        status.value = subscription ? 'active' : 'inactive';
      } catch {
        status.value = 'inconnu';
      }
    },
    enable: async () => {
      try {
        await subscribe();
        status.value = 'active';
        toast.show(ENABLED_TEXT);
      } catch (error) {
        toast.show(errorText(error), { error: true });
      }
    },
  };
};
