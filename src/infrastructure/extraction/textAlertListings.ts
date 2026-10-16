import type { EmailListing, EmailReading } from '../../application/ports/listingExtractor.js';
import { parseKm } from '../../domain/parsing/km.js';
import { parseLocation } from '../../domain/parsing/location.js';
import { parsePrice } from '../../domain/parsing/price.js';
import { cleanText } from '../../domain/parsing/text.js';
import { parseYear } from '../../domain/parsing/year.js';
import type { ListingRef } from '../../domain/sites/listingUrl.js';
import { adDescription } from './adDescription.js';
import { cleanTitle, textAdTitle } from './adTitle.js';
import { type LinkTarget, linkTarget, listingKey } from './listingLink.js';
import type { ReadingContext } from './readingContext.js';
import { sellerTypeOfText } from './sellerType.js';

const LINES_BEFORE_THE_LINK = 6;

const LINES_FROM_THE_LINK = 4;

interface TextLink {
  readonly href: string;
  readonly lineIndex: number;
  readonly target: LinkTarget;
}

interface ListingLine {
  readonly ref: ListingRef;
  readonly lineIndex: number;
}

const textLinks = (lines: readonly string[], context: ReadingContext): readonly TextLink[] =>
  lines.flatMap((line, lineIndex) => {
    const match = /https?:\/\/[^\s<>()"']+/.exec(line);
    if (!match) {
      return [];
    }
    const href = match[0].replace(/[.,;)]+$/, '');
    return [{ href, lineIndex, target: linkTarget(href, context.emailSite, context.resolvedLinks) }];
  });

const listingOfLine = (lines: readonly string[], { ref, lineIndex }: ListingLine, context: ReadingContext): EmailListing | undefined => {
  const blockText = lines
    .slice(Math.max(0, lineIndex - LINES_BEFORE_THE_LINK), lineIndex + LINES_FROM_THE_LINK)
    .map(cleanText)
    .filter((line) => line !== '')
    .join(' | ');
  const title = textAdTitle(lines, lineIndex);
  if (!title) {
    return undefined;
  }
  const location = parseLocation(blockText);
  return {
    site: ref.site,
    siteLabel: ref.siteLabel,
    externalId: ref.id,
    url: ref.url,
    title: cleanTitle(title),
    price: parsePrice(blockText),
    km: parseKm(blockText),
    year: parseYear(blockText, context.maxYear),
    city: location.city,
    postalCode: location.postalCode,
    sellerType: sellerTypeOfText(blockText),
    description: adDescription(blockText),
    sourceRef: context.sourceRef,
  };
};

export const textAlertListings = (text: string, context: ReadingContext): EmailReading => {
  const lines = text.replace(/\r/g, '').split('\n');
  const links = textLinks(lines, context);
  const pendingTexts = new Map(
    links.filter((link) => link.target.kind === 'pending').map((link) => [link.href, cleanText(lines[link.lineIndex - 1] ?? '')]),
  );
  const listingLines = links.flatMap((link) =>
    link.target.kind === 'listing' ? [{ ref: link.target.ref, lineIndex: link.lineIndex }] : [],
  );
  const firstLineOfEachListing = listingLines.filter(
    (listingLine, index) => listingLines.findIndex((other) => listingKey(other.ref) === listingKey(listingLine.ref)) === index,
  );
  const listings = firstLineOfEachListing
    .map((listingLine) => listingOfLine(lines, listingLine, context))
    .filter((listing) => listing !== undefined);
  return {
    site: context.emailSite?.key ?? listings[0]?.site,
    listings,
    pendingLinks: [...pendingTexts].map(([href, text]) => ({ href, text })),
    ignoredLinks: links.filter((link) => link.target.kind === 'other').length,
  };
};
