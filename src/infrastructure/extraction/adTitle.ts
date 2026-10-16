import type { CheerioAPI } from 'cheerio';
import type { AnyNode } from 'domhandler';
import { parseLocation } from '../../domain/parsing/location.js';
import { cleanText } from '../../domain/parsing/text.js';
import type { AdAnchor } from './adAnchor.js';
import { PRICE_OR_KM_MENTION } from './priceOrKmMention.js';
import { spacedText } from './spacedText.js';

const CALL_TO_ACTION =
  /^(voir|voir l'annonce|voir l’annonce|détails|details|consulter|contacter|j'y vais|découvrir|cliquez|en savoir plus|voir plus|voir toutes?|afficher|ouvrir)$/i;

const SPEC_LINE = new RegExp(`${PRICE_OR_KM_MENTION.source}|\\bann[ée]e\\s*:?\\s*\\d{4}\\b|^\\d{4}\\b`, 'i');

const MIN_TITLE_LENGTH = 6;

const MAX_TITLE_LENGTH = 160;

const MAX_FIRST_LINE_LENGTH = 120;

const LINES_ABOVE_A_TEXT_LINK = 8;

const MAX_CITY_LINE_WORDS = 4;

export const cleanTitle = (text: string): string =>
  cleanText(text)
    .replace(/\s*(\d[\d ]*\s?€.*)$/, '')
    .replace(/\s*-\s*$/, '')
    .slice(0, MAX_TITLE_LENGTH);

const longest = (texts: readonly string[]): string => texts.reduce((kept, text) => (text.length > kept.length ? text : kept), '');

const isLinkTitle = (text: string): boolean => text.length >= MIN_TITLE_LENGTH && !CALL_TO_ACTION.test(text) && !/^https?:/i.test(text);

export const htmlAdTitle = (
  $: CheerioAPI,
  group: readonly AdAnchor[],
  block: readonly AnyNode[],
  blockText: string,
): string | undefined => {
  const candidates = group.map((anchor) => anchor.text).filter(isLinkTitle);
  const titles = candidates.filter((text) => !SPEC_LINE.test(text));
  if (titles.length > 0) {
    return cleanTitle(longest(titles));
  }
  if (candidates.length > 0) {
    return cleanTitle(longest(candidates));
  }
  const heading = $(block).find('h1,h2,h3,h4,strong,b').first()[0];
  const headingText = heading ? spacedText(heading) : '';
  if (headingText.length >= MIN_TITLE_LENGTH && !CALL_TO_ACTION.test(headingText)) {
    return cleanTitle(headingText);
  }
  const alt = group
    .map((anchor) => cleanText($(anchor.element).find('img').attr('alt') ?? ''))
    .find((text) => text.length >= MIN_TITLE_LENGTH);
  if (alt) {
    return cleanTitle(alt);
  }
  const firstLine = blockText.split(/[|•\n]/)[0]?.trim();
  return firstLine && firstLine.length >= MIN_TITLE_LENGTH ? cleanTitle(firstLine.slice(0, MAX_FIRST_LINE_LENGTH)) : undefined;
};

const isTextTitle = (line: string): boolean => {
  if (!line || /^https?:/.test(line) || line.length < MIN_TITLE_LENGTH || CALL_TO_ACTION.test(line) || PRICE_OR_KM_MENTION.test(line)) {
    return false;
  }
  return !(/^\d{4}\b/.test(line) || (parseLocation(line).city && line.split(' ').length <= MAX_CITY_LINE_WORDS));
};

export const textAdTitle = (lines: readonly string[], linkIndex: number): string | undefined =>
  lines
    .slice(Math.max(0, linkIndex - LINES_ABOVE_A_TEXT_LINK), linkIndex)
    .map(cleanText)
    .reverse()
    .find(isTextTitle);
