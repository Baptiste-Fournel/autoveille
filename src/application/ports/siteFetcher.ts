import type { FetchedPage } from './listingExtractor.js';

export type SitePage =
  | ({ readonly kind: 'page' } & FetchedPage)
  | { readonly kind: 'invalidAddress' }
  | { readonly kind: 'disallowedByRobots' }
  | { readonly kind: 'refused'; readonly status: number }
  | { readonly kind: 'unexpectedStatus'; readonly status: number }
  | { readonly kind: 'antiBotPage' }
  | { readonly kind: 'unreachable'; readonly message: string };

export interface SiteFetcher {
  fetchPage(url: string): Promise<SitePage>;
}
