import type { AppState } from '../state/appState';

const REFRESH_INTERVAL_MS = 60_000;

export const startRefreshTriggers = (state: Pick<AppState, 'refresh' | 'router' | 'session'>, document: Document): (() => void) => {
  const visible = (): boolean => document.visibilityState === 'visible';
  const onTimer = (): void => {
    const screen = state.router.route.value.name;
    const typing = document.activeElement?.matches('textarea') === true;
    if (state.session.me.value?.authenticated === true && (screen === 'annonces' || screen === 'annonce') && visible() && !typing) {
      state.refresh.request();
    }
  };
  const onVisibilityChange = (): void => {
    if (visible() && state.router.route.value.name === 'annonces') {
      state.refresh.request();
    }
  };
  const timer = setInterval(onTimer, REFRESH_INTERVAL_MS);
  document.addEventListener('visibilitychange', onVisibilityChange);
  return () => {
    clearInterval(timer);
    document.removeEventListener('visibilitychange', onVisibilityChange);
  };
};
