import type { AlertMismatch, AlertWidening, LaCentraleCriteria } from '../sites/confirmations.js';
import { formatMileage } from './mileages.js';

const LACENTRALE_ALERT_ACTIVATED = 'Alerte activée';
export const PARUVENDU_ALERT_SAVED = 'Alerte enregistrée';
export const LEBONCOIN_SEARCH_SAVED = 'Recherche sauvegardée';
export const OTHER_SITE_ALERT_CREATED = 'Alerte créée';

const SELLER_CRITERIA: Readonly<Record<NonNullable<LaCentraleCriteria['sellerType']>, string>> = {
  particulier: 'particuliers',
  pro: 'professionnels',
};

export function laCentraleCriteriaText(criteria: LaCentraleCriteria): string {
  const { maxKm, postalCode, radiusKm, sellerType } = criteria;
  const parts = [
    maxKm ? `${formatMileage(maxKm)} max` : '',
    postalCode ? `${postalCode}${radiusKm ? ` (rayon de ${radiusKm} km)` : ''}` : '',
    sellerType ? SELLER_CRITERIA[sellerType] : '',
  ].filter((part) => part !== '');
  return parts.join(', ') || LACENTRALE_ALERT_ACTIVATED;
}

export function autoScout24CriteriaText(searchName: string | undefined): string {
  return searchName ? `Recherche « ${searchName} » enregistrée` : 'Recherche enregistrée';
}

export function alertMismatchSentence(mismatch: AlertMismatch): string {
  switch (mismatch.kind) {
    case 'radiusNarrower':
      return `L’alerte du site ne couvre que ${mismatch.alertRadiusKm} km autour de la ville, vos réglages vont jusqu’à ${mismatch.settingsRadiusKm} km : les annonces entre les deux n’arriveront jamais.`;
    case 'mileageNarrower':
      return `L’alerte du site s’arrête à ${formatMileage(mismatch.alertMaxKm)} au compteur, vos réglages acceptent jusqu’à ${formatMileage(mismatch.settingsMaxKm)}.`;
  }
}

export function alertAdviceSentence(widening: AlertWidening): string {
  const parts = [
    widening.radiusKm === undefined ? '' : `${widening.radiusKm} km de rayon`,
    widening.maxKm === undefined ? '' : `${formatMileage(widening.maxKm)} au compteur`,
  ].filter((part) => part !== '');
  return `Cette alerte est réglée au plus juste. Vous pouvez l’élargir (${parts.join(', ')}) : l’application garde votre tri, et les annonces écartées restent consultables au cas où une bonne affaire s’y cache.`;
}
