import { type BrandMatch, type CustomBrand, detectBrand } from '../catalog/brands.js';
import { cleanText, fold } from './text.js';

const MAX_MODEL_WORDS = 3;

const SITE_PLACEHOLDER_MODEL = /^(autres?|divers|other|inconnu|non renseign[ée]|nc)$/i;

const SPEC_WORD =
  /^(pdk|bva|bvm|dsg|tiptronic|auto|automatique|manuelle|diesel|essence|hybride|electrique|électrique|dci|tdi|hdi|tfsi|tsi|cdi|phev|4x4|4wd|awd|occasion|neuf|garantie|ct|ok)$/i;

const isSameWord = (a: string, b: string): boolean => a.localeCompare(b, 'fr', { sensitivity: 'base' }) === 0;

const isSmallNumberAfterFirstWord = (token: string, words: readonly string[]): boolean => words.length === 1 && /^\d{1,2}$/.test(token);

const isDisplacementOrNumber = (token: string, words: readonly string[]): boolean =>
  /^\d+([.,]\d+)?[lL]?$/.test(token) && words.length > 0 && !/^\d{3,4}$/.test(token) && !isSmallNumberAfterFirstWord(token, words);

const isUnitAfterModel = (token: string, words: readonly string[]): boolean => /^\d+(ch|cv|kw|km|l)$/i.test(token) && words.length > 0;

const endsModel = (token: string, words: readonly string[]): boolean =>
  isDisplacementOrNumber(token, words) ||
  isUnitAfterModel(token, words) ||
  /^(19|20)\d\d$/.test(token) ||
  SPEC_WORD.test(token) ||
  /^[-–|,:]$/.test(token);

const modelWords = (tokens: readonly string[]): readonly string[] => {
  const words: string[] = [];
  for (const token of tokens) {
    if (words.length >= MAX_MODEL_WORDS) {
      break;
    }
    const previous = words.at(-1);
    if (previous !== undefined && isSameWord(token, previous)) {
      continue;
    }
    if (endsModel(token, words)) {
      break;
    }
    words.push(token);
  }
  return words;
};

export function extractModel(title: string, modelStart: number): string | undefined {
  const rest = cleanText(title.slice(modelStart)).replace(/^[-–:,|]+\s*/, '');
  if (!rest || SITE_PLACEHOLDER_MODEL.test(rest.split(' ')[0] ?? '')) {
    return undefined;
  }
  const words = modelWords(rest.split(' '));
  return words.length > 0 ? words.join(' ') : undefined;
}

export function modelFromSellerWords(title: string, brand: BrandMatch, customBrands: readonly CustomBrand[]): string | undefined {
  const sellerWords = cleanText(title.slice(brand.modelStart))
    .replace(/^\S+\s*/, '')
    .replace(/^[-–:,|]+\s*/, '');
  if (!sellerWords) {
    return undefined;
  }
  const brandAgain = detectBrand(sellerWords, customBrands);
  const model =
    (brandAgain && brandAgain.make === brand.make ? extractModel(sellerWords, brandAgain.modelStart) : undefined) ??
    extractModel(sellerWords, 0);
  return model && fold(model) === fold(brand.make) ? undefined : model;
}
