import type { RedirectResolver } from '../../src/application/ports/redirectResolver.js';

export interface FakeRedirectResolver extends RedirectResolver {
  readonly requested: () => readonly string[];
}

export const fakeRedirectResolver = (destinations: Readonly<Record<string, string>> = {}): FakeRedirectResolver => {
  let requested: readonly string[] = [];
  return {
    resolve: async (href) => {
      requested = [...requested, href];
      return Object.hasOwn(destinations, href) ? destinations[href] : undefined;
    },
    requested: () => requested,
  };
};
