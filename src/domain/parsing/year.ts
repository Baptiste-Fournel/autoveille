import { cleanText } from './text.js';

export function maxPlausibleYear(currentYear: number): number {
  return currentYear + 1;
}

const labelledYear = (text: string, maxYear: number): number | undefined => {
  const match = /(?:ann[ée]e|mise en circulation|1[èe]re main|millésime)\s*:?\s*(?:\d{2}\/)?(19[5-9]\d|20\d\d)/iu.exec(text);
  const year = match ? Number(match[1]) : undefined;
  return year !== undefined && year <= maxYear ? year : undefined;
};

const isPriceOrKm = (followingText: string): boolean => /^\s?(€|km)/i.test(followingText);

const standaloneYear = (text: string, maxYear: number): number | undefined =>
  [...text.matchAll(/\b(?:\d{2}\/)?(19[5-9]\d|20\d\d)\b/g)]
    .filter((match) => {
      const end = match.index + match[0].length;
      return Number(match[1]) <= maxYear && !isPriceOrKm(text.slice(end, end + 3));
    })
    .map((match) => Number(match[1]))
    .at(0);

export function parseYear(text: string, maxYear: number): number | undefined {
  const cleaned = cleanText(text);
  return labelledYear(cleaned, maxYear) ?? standaloneYear(cleaned, maxYear);
}
