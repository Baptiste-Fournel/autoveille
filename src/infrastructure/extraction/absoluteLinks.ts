import { load } from 'cheerio';

const ALREADY_USABLE_LINK = /^(https?:|mailto:|tel:|javascript:|#)/i;

const ALREADY_USABLE_IMAGE = /^(https?:|data:)/i;

const madeAbsolute = (address: string | undefined, alreadyUsable: RegExp, pageUrl: string): string | undefined =>
  address && !alreadyUsable.test(address) && URL.canParse(address, pageUrl) ? new URL(address, pageUrl).toString() : undefined;

export const absoluteLinks = (html: string, pageUrl: string): string => {
  const $ = load(html);
  for (const link of $('a[href]').toArray()) {
    const absolute = madeAbsolute($(link).attr('href'), ALREADY_USABLE_LINK, pageUrl);
    if (absolute !== undefined) {
      $(link).attr('href', absolute);
    }
  }
  for (const image of $('img[src]').toArray()) {
    const absolute = madeAbsolute($(image).attr('src'), ALREADY_USABLE_IMAGE, pageUrl);
    if (absolute !== undefined) {
      $(image).attr('src', absolute);
    }
  }
  return $.html();
};
