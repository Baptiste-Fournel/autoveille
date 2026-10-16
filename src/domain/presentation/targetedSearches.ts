import type { TargetedSearch } from '../sites/alertSetup.js';
import { formatPrice } from './prices.js';

export function targetedSearchLabel(search: TargetedSearch): string {
  if (search.kind === 'collection') {
    return `Collection : toutes marques jusqu’à ${search.maxYear}`;
  }
  const priceFloor = search.minPrice ? ` à partir de ${formatPrice(search.minPrice)}` : '';
  return `${search.brandNames.join(', ')}${priceFloor}`;
}
