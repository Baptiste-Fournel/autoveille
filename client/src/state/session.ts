import type { Signal } from '@preact/signals';
import type { MeResponse } from '../../../src/shared/api';
import type { ApiClient } from '../api/client';

const LIST_HASH = '#/annonces';

export interface Session {
  readonly me: Signal<MeResponse | null>;
  readonly load: () => Promise<void>;
  readonly expire: (needsSetup: boolean) => void;
  readonly signIn: (password: string) => Promise<void>;
  readonly setUp: (setupCode: string, password: string) => Promise<void>;
}

export interface SessionDependencies {
  readonly me: Signal<MeResponse | null>;
  readonly api: ApiClient;
  readonly navigate: (hash: string) => void;
}

export const signedOut = (needsSetup: boolean): MeResponse => ({ authenticated: false, needsSetup, setupCodeRequired: true });

export const createSession = ({ me, api, navigate }: SessionDependencies): Session => {
  const load = async (): Promise<void> => {
    me.value = await api.me().catch(() => signedOut(false));
  };
  const enter = async (): Promise<void> => {
    navigate(LIST_HASH);
    await load();
  };
  return {
    me,
    load,
    expire: (needsSetup) => {
      me.value = signedOut(needsSetup);
    },
    signIn: async (password) => {
      await api.login({ password });
      await enter();
    },
    setUp: async (setupCode, password) => {
      await api.setup({ setupCode, password });
      await enter();
    },
  };
};
