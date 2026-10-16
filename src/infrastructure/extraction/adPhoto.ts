import type { CheerioAPI } from 'cheerio';
import type { AnyNode, Element } from 'domhandler';
import type { EmailListing } from '../../application/ports/listingExtractor.js';
import { domainBelongsTo, SITES } from '../../domain/sites/catalog.js';

const MIN_PICTURE_SIZE = 40;

const NOT_A_PHOTO = /pixel|track|beacon|spacer|logo|icon|picto|button|bouton|badge|arrow|fleche|store/i;

const visibleSource = ($: CheerioAPI, image: Element): string | undefined => {
  const source = ($(image).attr('src') ?? '').trim();
  const width = Number($(image).attr('width') ?? 0);
  const height = Number($(image).attr('height') ?? 0);
  if (!/^https?:/i.test(source)) {
    return undefined;
  }
  if ((width && width < MIN_PICTURE_SIZE) || (height && height < MIN_PICTURE_SIZE)) {
    return undefined;
  }
  return /display\s*:\s*none/i.test($(image).attr('style') ?? '') ? undefined : source;
};

const servedBy = (source: string, photoHosts: readonly string[]): boolean => {
  if (!URL.canParse(source)) {
    return false;
  }
  const host = new URL(source).hostname.toLowerCase();
  return photoHosts.some((photoHost) => domainBelongsTo(host, photoHost));
};

export const adPhoto = ($: CheerioAPI, block: readonly AnyNode[], site: string): string | undefined => {
  const sources = $(block)
    .find('img[src]')
    .toArray()
    .map((image) => visibleSource($, image))
    .filter((source) => source !== undefined);
  const photoHosts = SITES.find((known) => known.key === site)?.photoHosts ?? [];
  if (photoHosts.length > 0) {
    return sources.find((source) => servedBy(source, photoHosts));
  }
  return sources.find((source) => !NOT_A_PHOTO.test(source));
};

export const withoutSharedPictures = (listings: readonly EmailListing[]): readonly EmailListing[] =>
  listings.map((listing) =>
    listing.imageUrl && listings.filter((other) => other.imageUrl === listing.imageUrl).length > 1
      ? { ...listing, imageUrl: undefined }
      : listing,
  );
