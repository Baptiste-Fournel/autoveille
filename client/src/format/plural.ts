import { formatInteger } from './integer';

export const plural = (count: number, singular: string, pluralForm: string): string =>
  `${formatInteger(count)} ${count > 1 ? pluralForm : singular}`;
