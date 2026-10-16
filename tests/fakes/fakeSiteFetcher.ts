import type { SiteFetcher, SitePage } from '../../src/application/ports/siteFetcher.js';

export interface FakeSiteFetcher extends SiteFetcher {
  readonly requested: () => readonly string[];
}

const UNREACHABLE: SitePage = { kind: 'unreachable', message: 'getaddrinfo ENOTFOUND' };

export const fakeSiteFetcher = (pages: Readonly<Record<string, SitePage>> = {}): FakeSiteFetcher => {
  let requested: readonly string[] = [];
  return {
    fetchPage: async (url) => {
      requested = [...requested, url];
      return (Object.hasOwn(pages, url) ? pages[url] : undefined) ?? UNREACHABLE;
    },
    requested: () => requested,
  };
};
