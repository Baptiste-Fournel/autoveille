import type { SiteDef } from '../../domain/sites/catalog.js';
import { type ListingRef, listingRef } from '../../domain/sites/listingUrl.js';
import { unwrapTrackingUrl } from '../../domain/sites/tracking.js';

export type LinkTarget = { readonly kind: 'listing'; readonly ref: ListingRef } | { readonly kind: 'pending' } | { readonly kind: 'other' };

const targetOf = (ref: ListingRef | undefined): LinkTarget => (ref ? { kind: 'listing', ref } : { kind: 'other' });

export const linkTarget = (href: string, emailSite: SiteDef | undefined, resolvedLinks: ReadonlyMap<string, string>): LinkTarget => {
  const resolved = resolvedLinks.get(href);
  if (resolved) {
    return targetOf(listingRef(resolved, emailSite));
  }
  const unwrapped = unwrapTrackingUrl(href);
  return unwrapped.resolved ? targetOf(listingRef(unwrapped.url, emailSite)) : { kind: 'pending' };
};

export const listingKey = (ref: ListingRef): string => `${ref.site}:${ref.id}`;
