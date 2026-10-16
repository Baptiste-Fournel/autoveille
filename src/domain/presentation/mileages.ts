import { formatInteger } from './numbers.js';

export const formatMileage = (km: number): string => `${formatInteger(km)} km`;
