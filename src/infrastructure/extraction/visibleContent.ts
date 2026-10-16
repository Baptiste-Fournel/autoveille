import { load } from 'cheerio';
import type { EmailMessage, VisibleContent } from '../../application/ports/listingExtractor.js';
import { cleanText } from '../../domain/parsing/text.js';

const withoutInvisibleCharacters = (text: string): string => text.replace(/[\u200B-\u200F\u00AD]|\u034F/g, '');

const visibleHtml = (html: string): VisibleContent => {
  const $ = load(html);
  $('script, style, head').remove();
  const texts = $('body *')
    .toArray()
    .flatMap((element) => element.children.flatMap((child) => (child.type === 'text' && 'data' in child ? [child.data] : [])));
  const links = $('a[href]')
    .toArray()
    .map((link) => ({ text: cleanText($(link).text()), href: ($(link).attr('href') ?? '').trim() }));
  return { text: cleanText(withoutInvisibleCharacters(texts.join(' '))), links };
};

export const visibleContent = (email: Pick<EmailMessage, 'html' | 'text'>): VisibleContent =>
  email.html ? visibleHtml(email.html) : { text: cleanText(email.text ?? ''), links: [] };
