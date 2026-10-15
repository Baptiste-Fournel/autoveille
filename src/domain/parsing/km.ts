import { digitGroups, parseGroupedDigits } from './groupedDigits.js';
import { cleanText } from './text.js';

const MIN_PLAUSIBLE_KM = 100;
const MAX_PLAUSIBLE_KM = 2_000_000;
const MIN_KM_GLUED_TO_PRICE = 1000;

const isPlausibleKm = (km: number): boolean => km >= MIN_PLAUSIBLE_KM && km <= MAX_PLAUSIBLE_KM;

const kmGluedToPrice = (groups: readonly string[]): number | undefined =>
  [2, 1]
    .filter((count) => groups.length > count)
    .map((count) => parseGroupedDigits(groups.slice(-count).join('')))
    .find((km) => km >= MIN_KM_GLUED_TO_PRICE && km <= MAX_PLAUSIBLE_KM);

const kmOf = (digits: string): number | undefined => {
  const km = parseGroupedDigits(digits);
  return isPlausibleKm(km) ? km : kmGluedToPrice(digitGroups(digits));
};

export function parseKm(text: string): number | undefined {
  const mentions = [...cleanText(text).matchAll(/(?<![\d,.\p{L}])(\d{1,3}(?:[ .]\d{3})+|\d{1,7})\s?kms?\b/giu)];
  return mentions.map((match) => kmOf(match[1] ?? '')).find((km) => km !== undefined);
}
