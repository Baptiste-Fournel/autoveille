export type RejectionReason =
  | { readonly kind: 'unfollowedBrand'; readonly make: string }
  | { readonly kind: 'disabledBrand'; readonly make: string }
  | { readonly kind: 'unknownBrand' }
  | { readonly kind: 'notSpecial' }
  | { readonly kind: 'professionalSeller' }
  | { readonly kind: 'mileageAbove'; readonly km: number; readonly maxKm: number }
  | { readonly kind: 'outsideRadius'; readonly distanceKm: number; readonly radiusKm: number };

export type SpecialReason =
  | { readonly kind: 'priceFloor'; readonly minPrice: number }
  | { readonly kind: 'yearCap'; readonly maxYear: number }
  | { readonly kind: 'keyword'; readonly keyword: string };

export interface Verdict {
  readonly pass: boolean;
  readonly rejections: readonly RejectionReason[];
}

const sameRejection = (a: RejectionReason, b: RejectionReason): boolean => {
  switch (a.kind) {
    case 'unfollowedBrand':
      return b.kind === 'unfollowedBrand' && b.make === a.make;
    case 'disabledBrand':
      return b.kind === 'disabledBrand' && b.make === a.make;
    case 'unknownBrand':
    case 'notSpecial':
    case 'professionalSeller':
      return b.kind === a.kind;
    case 'mileageAbove':
      return b.kind === 'mileageAbove' && b.km === a.km && b.maxKm === a.maxKm;
    case 'outsideRadius':
      return b.kind === 'outsideRadius' && Math.round(b.distanceKm) === Math.round(a.distanceKm) && b.radiusKm === a.radiusKm;
  }
};

export const sameRejections = (a: readonly RejectionReason[], b: readonly RejectionReason[]): boolean =>
  a.length === b.length &&
  a.every((reason, index) => {
    const other = b[index];
    return other !== undefined && sameRejection(reason, other);
  });
