import type { SellerType } from '../../domain/vehicle/types.js';

export const sellerTypeOfText = (text: string): SellerType => {
  if (/\b(professionnel|\bpro\b|garage|concession|société|societe)\b/i.test(text)) {
    return 'pro';
  }
  return /\bparticulier\b/i.test(text) ? 'particulier' : 'inconnu';
};
