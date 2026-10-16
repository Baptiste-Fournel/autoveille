import type { Element } from 'domhandler';
import type { ListingRef } from '../../domain/sites/listingUrl.js';

export interface AdAnchor {
  readonly element: Element;
  readonly ref: ListingRef;
  readonly key: string;
  readonly text: string;
}

export type AnchorKeyOf = (element: Element) => string | undefined;
