import { type ReadonlySignal, signal } from '@preact/signals';
import { type Route, routeKeyOf, routeOf } from './route';

export interface Router {
  readonly route: ReadonlySignal<Route>;
  readonly navigate: (hash: string) => void;
  readonly stop: () => void;
}

export const createRouter = (window: Window): Router => {
  const route = signal(routeOf(window.location.hash));
  const follow = (): void => {
    const next = routeOf(window.location.hash);
    if (routeKeyOf(next) !== routeKeyOf(route.value)) {
      window.scrollTo({ top: 0 });
    }
    route.value = next;
  };
  window.addEventListener('hashchange', follow);
  return {
    route,
    navigate: (hash) => {
      window.location.hash = hash;
    },
    stop: () => window.removeEventListener('hashchange', follow),
  };
};
