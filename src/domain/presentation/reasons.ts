import type { RejectionReason } from '../filtering/verdict.js';
import { formatMileage } from './mileages.js';

export function describeRejection(reason: RejectionReason): string {
  switch (reason.kind) {
    case 'unfollowedBrand':
      return `marque ${reason.make} hors des familles suivies`;
    case 'unknownBrand':
      return 'marque non reconnue';
    case 'disabledBrand':
      return `marque ${reason.make} désactivée`;
    case 'notSpecial':
      return 'ni supercar ni collection selon les réglages';
    case 'professionalSeller':
      return 'vendeur professionnel';
    case 'mileageAbove':
      return `${formatMileage(reason.km)}, au-dessus de ${formatMileage(reason.maxKm)}`;
    case 'outsideRadius':
      return `à ${Math.round(reason.distanceKm)} km, hors du rayon de ${reason.radiusKm} km`;
  }
}
