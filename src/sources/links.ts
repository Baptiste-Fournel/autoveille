import type { Settings } from '../types.js';
import { SITES } from './sites.js';

export interface SiteSetup {
  key: string;
  label: string;
  searchUrl: string;
  prefilled: boolean;
  help: string;
}

/**
 * Search pages pre-filled with the zone, the mileage cap and "private sellers" wherever the site's
 * URL parameters are known. The person opens the link, checks the criteria, and clicks "créer une alerte".
 */
export function siteSetups(settings: Settings): SiteSetup[] {
  const { zone, maxKm } = settings;
  const radius = zone.radiusKm || 100;
  const city = zone.city || 'Bordeaux';
  const postal = zone.postalCode || '33000';
  const lat = zone.lat ?? 44.8378, lon = zone.lon ?? -0.5792;
  const km = maxKm || 100000;
  const urls: Record<string, { url: string; prefilled: boolean }> = {
    leboncoin: {
      url: `https://www.leboncoin.fr/recherche?category=2&locations=${encodeURIComponent(city)}__${lat.toFixed(4)}_${lon.toFixed(4)}_5000_${radius * 1000}&owner_type=private&mileage=min-${km}`,
      prefilled: true,
    },
    lacentrale: { url: `https://www.lacentrale.fr/listing?customerFamilyCodes=PARTICULIER&mileageMax=${km}&dist=${radius}&location=${encodeURIComponent(city)}`, prefilled: true },
    autoscout24: { url: `https://www.autoscout24.fr/lst?custtype=P&kmto=${km}&zip=${postal}&zipr=${radius}&cy=F&atype=C`, prefilled: true },
    paruvendu: { url: 'https://www.paruvendu.fr/a/voiture-occasion/', prefilled: false },
    largus: { url: 'https://occasion.largus.fr/voiture-occasion/', prefilled: false },
    'ouestfrance-auto': { url: 'https://www.ouestfrance-auto.com/voiture-occasion/', prefilled: false },
    'annonces-automobile': { url: 'https://www.annonces-automobile.com/', prefilled: false },
    leparking: { url: 'https://www.leparking.fr/voiture-occasion/', prefilled: false },
  };
  return SITES.map((s) => ({
    key: s.key,
    label: s.label,
    searchUrl: urls[s.key]?.url ?? '',
    prefilled: urls[s.key]?.prefilled ?? false,
    help: s.alertHelp,
  }));
}
