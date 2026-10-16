import type { CheerioAPI } from 'cheerio';
import type { AnyNode, Element } from 'domhandler';
import type { EmailListing } from '../../application/ports/listingExtractor.js';
import { domainBelongsTo, SITES } from '../../domain/sites/catalog.js';

const MIN_PICTURE_SIZE = 40;

const NOT_A_PHOTO = /pixel|track|beacon|spacer|logo|icon|picto|button|bouton|badge|arrow|fleche|store/i;

const BACKGROUND_IMAGE_URL = /background(?:-image)?\s*:[^;]*?url\(\s*['"]?(https?:[^'")\s]+)/i;

const isShown = ($: CheerioAPI, element: Element): boolean => {
  const width = Number($(element).attr('width') ?? 0);
  const height = Number($(element).attr('height') ?? 0);
  if ((width && width < MIN_PICTURE_SIZE) || (height && height < MIN_PICTURE_SIZE)) {
    return false;
  }
  return !/display\s*:\s*none/i.test($(element).attr('style') ?? '');
};

const isElement = (node: AnyNode): node is Element => node.type === 'tag';

const webSource = (source: string | undefined): string | undefined => {
  const trimmed = (source ?? '').trim();
  return /^https?:/i.test(trimmed) ? trimmed : undefined;
};

const pictureSource = ($: CheerioAPI, image: Element): string | undefined =>
  isShown($, image) ? webSource($(image).attr('src')) : undefined;

const backgroundSource = ($: CheerioAPI, element: Element): string | undefined => {
  if (!isShown($, element)) {
    return undefined;
  }
  return webSource($(element).attr('background')) ?? webSource(BACKGROUND_IMAGE_URL.exec($(element).attr('style') ?? '')?.[1]);
};

const servedBy = (source: string, photoHosts: readonly string[]): boolean => {
  if (!URL.canParse(source)) {
    return false;
  }
  const host = new URL(source).hostname.toLowerCase();
  return photoHosts.some((photoHost) => domainBelongsTo(host, photoHost));
};

export const adPhoto = ($: CheerioAPI, block: readonly AnyNode[], site: string): string | undefined => {
  const elements = $(block).find('*').addBack().toArray().filter(isElement);
  const pictures = elements.filter((element) => element.tagName === 'img').map((image) => pictureSource($, image));
  const backgrounds = elements.map((element) => backgroundSource($, element));
  const sources = [...pictures, ...backgrounds].filter((source) => source !== undefined);
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
