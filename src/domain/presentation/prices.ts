import { formatInteger } from './numbers.js';

export const formatPrice = (price: number): string => `${formatInteger(price)} €`;
