import { type CheerioAPI, load } from 'cheerio';
import type { Element } from 'domhandler';
import type { EmailListing, EmailReading, PendingLink } from '../../application/ports/listingExtractor.js';
import { parseDepartment } from '../../domain/parsing/department.js';
import { parseKm } from '../../domain/parsing/km.js';
import { parseLocation } from '../../domain/parsing/location.js';
import { parsePrice } from '../../domain/parsing/price.js';
import { cleanText } from '../../domain/parsing/text.js';
import { parseYear } from '../../domain/parsing/year.js';
import type { AdAnchor, AnchorKeyOf } from './adAnchor.js';
import { adBlock } from './adBlock.js';
import { adDescription } from './adDescription.js';
import { adPhoto, withoutSharedPictures } from './adPhoto.js';
import { htmlAdTitle } from './adTitle.js';
import { linkTarget, listingKey } from './listingLink.js';
import { type CaptionedLink, moreResultsUrl } from './moreResultsLink.js';
import type { ReadingContext } from './readingContext.js';
import { sellerTypeOfText } from './sellerType.js';
import { spacedText } from './spacedText.js';

type EmailLinkReading =
  | { readonly kind: 'listing'; readonly anchor: AdAnchor }
  | { readonly kind: 'pending'; readonly link: PendingLink }
  | { readonly kind: 'other'; readonly link: CaptionedLink };

const linkReading = ($: CheerioAPI, element: Element, context: ReadingContext): readonly EmailLinkReading[] => {
  const href = ($(element).attr('href') ?? '').trim();
  if (!/^https?:/i.test(href)) {
    return [];
  }
  const target = linkTarget(href, context.emailSite, context.resolvedLinks);
  const text = spacedText(element);
  switch (target.kind) {
    case 'pending':
      return [{ kind: 'pending', link: { href, text } }];
    case 'other':
      return [{ kind: 'other', link: { href, caption: text || cleanText($(element).find('img').attr('alt') ?? '') } }];
    case 'listing':
      return [{ kind: 'listing', anchor: { element, ref: target.ref, key: listingKey(target.ref), text } }];
  }
};

const firstOfEachHref = (links: readonly PendingLink[]): readonly PendingLink[] =>
  links.filter((link, index) => links.findIndex((other) => other.href === link.href) === index);

const listingOfGroup = (
  $: CheerioAPI,
  group: readonly AdAnchor[],
  keyOf: AnchorKeyOf,
  context: ReadingContext,
): EmailListing | undefined => {
  const block = adBlock($, group, keyOf);
  const blockText = cleanText(block.map(spacedText).join(' '));
  const title = htmlAdTitle($, group, block, blockText);
  const ref = group[0]?.ref;
  if (!title || !ref) {
    return undefined;
  }
  const location = parseLocation(blockText);
  const department = location.postalCode ? undefined : parseDepartment(blockText);
  return {
    site: ref.site,
    siteLabel: ref.siteLabel,
    externalId: ref.id,
    url: ref.url,
    title,
    price: parsePrice(blockText),
    km: parseKm(blockText),
    year: parseYear(`${title} ${blockText}`, context.maxYear),
    city: location.city ?? department?.city,
    postalCode: location.postalCode ?? department?.postalCode,
    sellerType: sellerTypeOfText(blockText),
    description: adDescription(blockText),
    imageUrl: adPhoto($, block, ref.site),
    sourceRef: context.sourceRef,
  };
};

export const htmlAlertListings = (html: string, context: ReadingContext): EmailReading => {
  const $ = load(html);
  $('script, style, head, title').remove();
  const readings = $('a[href]')
    .toArray()
    .flatMap((element) => linkReading($, element, context));
  const anchors = readings.flatMap((reading) => (reading.kind === 'listing' ? [reading.anchor] : []));
  const pendingLinks = firstOfEachHref(readings.flatMap((reading) => (reading.kind === 'pending' ? [reading.link] : [])));
  const otherLinks = readings.flatMap((reading) => (reading.kind === 'other' ? [reading.link] : []));
  const keyOf: AnchorKeyOf = (element) => anchors.find((anchor) => anchor.element === element)?.key;
  const keys = [...new Set(anchors.map((anchor) => anchor.key))];
  const listings = withoutSharedPictures(
    keys
      .map((key) =>
        listingOfGroup(
          $,
          anchors.filter((anchor) => anchor.key === key),
          keyOf,
          context,
        ),
      )
      .filter((listing) => listing !== undefined),
  );
  return {
    site: context.emailSite?.key ?? listings[0]?.site,
    listings,
    pendingLinks,
    ignoredLinks: otherLinks.length,
    moreUrl: otherLinks.map((link) => moreResultsUrl(link, context.emailSite, context.resolvedLinks)).find((url) => url !== undefined),
  };
};
