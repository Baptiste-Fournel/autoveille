import { digitGroups, parseGroupedDigits } from './groupedDigits.js';
import { cleanText } from './text.js';

const MIN_PLAUSIBLE_PRICE = 100;
const MAX_PLAUSIBLE_PRICE = 5_000_000;

const isPlausiblePrice = (price: number): boolean => price >= MIN_PLAUSIBLE_PRICE && price <= MAX_PLAUSIBLE_PRICE;

const highestPlausible = (prices: readonly number[]): number | undefined => {
  const plausible = prices.filter(isPlausiblePrice);
  return plausible.length > 0 ? Math.max(...plausible) : undefined;
};

const pricesWithCurrencyAfter = (text: string): readonly number[] =>
  [...text.matchAll(/(?<![\d,.\p{L}])(\d{1,3}(?:[ .]\d{3})+|\d{3,7})\s?(?:€|eur\b|euros?\b)/giu)].map((match) =>
    parseGroupedDigits(match[1] ?? ''),
  );

const groupsBeforeGluedKm = (groups: readonly string[]): readonly string[] => groups.slice(0, groups.length >= 3 ? -2 : -1);

const pricesWithCurrencyBefore = (text: string): readonly number[] =>
  [...text.matchAll(/(?:€|\beur\b|\beuros?\b)\s?(\d{1,3}(?:[ .]\d{3})*|\d{3,7})(?![\d])(\s?km\b)?/giu)].map((match) => {
    const groups = digitGroups(match[1] ?? '');
    const kmFollows = match[2] !== undefined && groups.length >= 2;
    return parseGroupedDigits((kmFollows ? groupsBeforeGluedKm(groups) : groups).join(''));
  });

const labelledPrice = (text: string): number | undefined => {
  const match = /prix\s*:?\s*(\d{1,3}(?:[ .]\d{3})+|\d{3,7})(?![\d])/iu.exec(text);
  return match ? parseGroupedDigits(match[1] ?? '') : undefined;
};

export function parsePrice(text: string): number | undefined {
  const cleaned = cleanText(text);
  return (
    highestPlausible(pricesWithCurrencyAfter(cleaned)) ?? highestPlausible(pricesWithCurrencyBefore(cleaned)) ?? labelledPrice(cleaned)
  );
}
