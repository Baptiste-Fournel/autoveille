import type { Settings } from '../types.js';
import { SITES } from './sites.js';

export interface SiteSetup {
  key: string;
  label: string;
  searchUrl: string;
  prefilled: boolean;
  help: string;
  manageUrl?: string;
  /** The net the alert should cast: wider than the settings, since the app sorts afterwards. */
  alertRadiusKm: number;
  alertMaxKm: number;
}

/** A site alert is cast wider than the settings: the app does the fine sorting, and what it sets aside stays readable. */
export function alertBounds(settings: Settings): { radiusKm: number; maxKm: number } {
  const radius = settings.zone.radiusKm || 100;
  const km = settings.maxKm || 100000;
  return {
    radiusKm: Math.min(400, Math.max(150, Math.ceil((radius * 1.5) / 50) * 50)),
    maxKm: Math.min(300000, Math.max(150000, Math.ceil((km * 1.5) / 10000) * 10000)),
  };
}

/**
 * Search pages pre-filled with the zone, the mileage cap and "private sellers" wherever the site's
 * URL parameters are known. The person opens the link, checks the criteria, and clicks "créer une alerte".
 */
export function siteSetups(settings: Settings): SiteSetup[] {
  const { zone } = settings;
  const bounds = alertBounds(settings);
  const radius = bounds.radiusKm;
  const city = zone.city || 'Bordeaux';
  const postal = zone.postalCode || '33000';
  const lat = zone.lat ?? 44.8378, lon = zone.lon ?? -0.5792;
  const km = bounds.maxKm;
  const urls: Record<string, { url: string; prefilled: boolean }> = {
    leboncoin: {
      url: `https://www.leboncoin.fr/recherche?category=2&locations=${encodeURIComponent(city)}__${lat.toFixed(4)}_${lon.toFixed(4)}_5000_${radius * 1000}&owner_type=private&mileage=min-${km}`,
      prefilled: true,
    },
    // Formats vérifiés le 14/10/2026 sur les sites eux-mêmes.
    lacentrale: { url: `https://www.lacentrale.fr/listing?customerFamilyCodes=PART&dptCp=${postal}&mileageMax=${km}`, prefilled: true },
    autoscout24: { url: `https://www.autoscout24.fr/lst?custtype=P&kmto=${km}&zip=${postal}&zipr=${radius}&cy=F&atype=C`, prefilled: true },
    // ParuVendu identifie la ville par son code INSEE ; seul celui de Bordeaux est connu ici.
    paruvendu: /^bordeaux$/i.test(city.trim())
      ? { url: `https://www.paruvendu.fr/auto-moto/listefo/default/default?reaf=1&codeINSEE=33063%2C&ray=${radius}&r=VVO00000&km1=${km}&codPro=off`, prefilled: true }
      : { url: 'https://www.paruvendu.fr/voiture-occasion/', prefilled: false },
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
    manageUrl: s.manageUrl,
    alertRadiusKm: bounds.radiusKm,
    alertMaxKm: bounds.maxKm,
  }));
}
