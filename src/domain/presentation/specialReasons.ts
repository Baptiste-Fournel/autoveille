import type { SpecialReason } from '../filtering/verdict.js';
import { formatPrice } from './prices.js';

export function describeSpecialReason(reason: SpecialReason): string {
  switch (reason.kind) {
    case 'priceFloor':
      return `prix ≥ ${formatPrice(reason.minPrice)}`;
    case 'yearCap':
      return `année ≤ ${reason.maxYear}`;
    case 'keyword':
      return `modèle « ${reason.keyword} »`;
  }
}
