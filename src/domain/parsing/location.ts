import { BRANDS } from '../catalog/brands.js';
import { cleanText, titleCase } from './text.js';

export interface ParsedLocation {
  readonly city?: string;
  readonly postalCode?: string;
}

const MAX_CITY_WORDS = 4;

const BRAND_WORDS: readonly string[] = BRANDS.flatMap((brand) => [brand.name, ...brand.aliases]).flatMap((name) =>
  name.toLowerCase().split(/[\s-]+/),
);

const NOT_CITY_WORDS: readonly string[] = [
  'particulier',
  'particuliers',
  'pro',
  'professionnel',
  'voir',
  "l'annonce",
  'annonce',
  'prix',
  'km',
  'kms',
  'essence',
  'diesel',
  'hybride',
  'electrique',
  'électrique',
  'automatique',
  'manuelle',
  'boite',
  'boîte',
  'annee',
  'année',
  'kilometrage',
  'kilométrage',
  'neuf',
  'occasion',
  'contacter',
  'details',
  'détails',
  'cliquez',
  'ici',
  'nouveau',
  'nouvelle',
  'garantie',
  'ct',
  'ok',
  'dans',
  'à',
  'a',
  'chez',
  'par',
  'vendu',
  'vendeur',
  'livraison',
  'possible',
  'gps',
  'cuir',
  'toit',
  'jantes',
  'pack',
  'ch',
  'cv',
  'portes',
  'places',
  'coupe',
  'coupé',
  'cabriolet',
  'berline',
  'break',
  'suv',
];

const CITY_CONNECTORS: readonly string[] = ['de', 'du', 'des', 'la', 'le', 'les', 'sur', 'en', 'et', 'sous', 'aux', 'au', "d'", "l'"];

const isConnector = (word: string): boolean => CITY_CONNECTORS.includes(word.toLowerCase());

const isCityWord = (token: string): boolean => {
  const word = token.toLowerCase();
  return /^[\p{L}][\p{L}'’-]*$/u.test(token) && !NOT_CITY_WORDS.includes(word) && !BRAND_WORDS.includes(word);
};

const withoutEdgeConnectors = (words: readonly string[]): readonly string[] => {
  const kept = words.map((word, index) => ({ word, index })).filter(({ word }) => !isConnector(word));
  const first = kept.at(0);
  const last = kept.at(-1);
  return first && last ? words.slice(first.index, last.index + 1) : [];
};

const isDash = (token: string): boolean => token === '-' || token === '–' || token === '';

const cityWordsBefore = (tokens: readonly string[], postalIndex: number): readonly string[] => {
  const words: string[] = [];
  for (let index = postalIndex - 1; index >= 0 && words.length < MAX_CITY_WORDS; index--) {
    const token = (tokens[index] ?? '').replace(/[,;:(]+$/, '');
    if (isDash(token)) {
      if (words.length > 0) {
        break;
      }
      continue;
    }
    if (!isCityWord(token)) {
      break;
    }
    words.unshift(token);
  }
  return words;
};

const cityWordsAfter = (tokens: readonly string[], postalIndex: number): readonly string[] => {
  const words: string[] = [];
  for (let index = postalIndex + 1; index < tokens.length && words.length < MAX_CITY_WORDS; index++) {
    const token = (tokens[index] ?? '').replace(/^[,;:(-]+|[,;:).]+$/g, '');
    if (!token) {
      continue;
    }
    if (!isCityWord(token)) {
      break;
    }
    words.push(token);
  }
  return words;
};

const locationAroundPostalCode = (tokens: readonly string[], postalIndex: number, postalCode: string): ParsedLocation => {
  const before = withoutEdgeConnectors(cityWordsBefore(tokens, postalIndex));
  const after = withoutEdgeConnectors(cityWordsAfter(tokens, postalIndex));
  const city = before.length > 0 ? before : after;
  return city.length > 0 ? { postalCode, city: titleCase(city.join(' ')) } : { postalCode };
};

const locationWithDepartment = (text: string): ParsedLocation => {
  const match = /([\p{L}][\p{L}'’ -]{1,40}?)\s*\((\d{2})\)/u.exec(text);
  if (!match) {
    return {};
  }
  const words = withoutEdgeConnectors((match[1] ?? '').trim().split(' ').filter(isCityWord).slice(-MAX_CITY_WORDS));
  return words.length > 0 ? { postalCode: `${match[2]}000`, city: titleCase(words.join(' ')) } : {};
};

export function parseLocation(text: string): ParsedLocation {
  const cleaned = cleanText(text).replace(/[|•·]/g, ' ');
  const tokens = cleaned.split(' ').filter(Boolean);
  const postalIndex = tokens.findIndex((token) => /^\d{5}$/.test(token));
  const postalCode = tokens[postalIndex];
  return postalCode === undefined ? locationWithDepartment(cleaned) : locationAroundPostalCode(tokens, postalIndex, postalCode);
}
