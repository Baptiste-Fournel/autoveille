const COMBINING_ACCENTS = /[̀-ͯ]/g;

export const foldForSearch = (text: string | null | undefined): string =>
  String(text || '')
    .normalize('NFD')
    .replace(COMBINING_ACCENTS, '')
    .toLowerCase()
    .trim();
