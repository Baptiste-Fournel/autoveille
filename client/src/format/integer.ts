const NARROW_NO_BREAK_SPACE = / /g;

export const formatInteger = (value: number | null | undefined): string =>
  value === null || value === undefined ? '' : Math.round(value).toLocaleString('fr-FR').replace(NARROW_NO_BREAK_SPACE, ' ');
