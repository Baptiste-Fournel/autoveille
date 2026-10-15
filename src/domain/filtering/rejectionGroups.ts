import type { RejectionReason } from './verdict.js';

export type RejectionGroup = 'marque' | 'special' | 'pro' | 'km' | 'loin';

const GROUP_OF_KIND: Readonly<Record<RejectionReason['kind'], RejectionGroup>> = {
  unfollowedBrand: 'marque',
  disabledBrand: 'marque',
  unknownBrand: 'marque',
  notSpecial: 'special',
  professionalSeller: 'pro',
  mileageAbove: 'km',
  outsideRadius: 'loin',
};

export function rejectionGroupOf(reason: RejectionReason): RejectionGroup {
  return GROUP_OF_KIND[reason.kind];
}
