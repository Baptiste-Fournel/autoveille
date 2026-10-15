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

export interface TargetedSearch { label: string; url: string; brands: string[]; minPrice?: number; maxYear?: number }

/** La Centrale's brand codes: upper case, no accents, "Mercedes-Benz" is just MERCEDES. */
function lacentraleBrand(name: string): string {
  const up = name.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().trim();
  return up === 'MERCEDES-BENZ' ? 'MERCEDES' : up;
}

/**
 * One alert per small group of brands for sites whose alert emails only preview a few ads (La Centrale shows
 * three): each alert then stays under that preview most days. Price floors are set below the rules on
 * purpose (three quarters, rounded down to 5 000 €): the application does the fine sorting afterwards.
 * La Centrale accepts three brands per saved search at most.
 */
export function targetedSearches(settings: Settings, site = 'lacentrale'): TargetedSearch[] {
  if (site !== 'lacentrale') return [];
  const postal = settings.zone.postalCode || '33000';
  const km = alertBounds(settings).maxKm;
  const base = (extra: string) => `https://www.lacentrale.fr/listing?${extra}&customerFamilyCodes=PART&distance=5&dptCp=${postal}&mileageMax=${km}&sortBy=firstOnlineDateDesc`;
  const out: TargetedSearch[] = [];
  let oldest = 0;
  for (const key of ['allemandes', 'italiennes', 'americaines', 'francaises'] as const) {
    const f = settings.families[key];
    if (!f?.enabled || !f.brands.length) continue;
    const floor = f.minPrice > 0 ? Math.max(5000, Math.floor((f.minPrice * 0.75) / 5000) * 5000) : 0;
    if (f.maxYear > oldest) oldest = f.maxYear;
    // Ford is American only through its US models; Mustang is the one La Centrale knows as a model code.
    const names = new Map<string, string>();
    const codes = f.brands.map((b) => {
      const code = key === 'americaines' && /^ford$/i.test(b) ? 'FORD:MUSTANG' : lacentraleBrand(b);
      names.set(code, code === 'FORD:MUSTANG' ? 'Ford Mustang' : b.trim());
      return code;
    });
    // Common brands get an alert of their own; rare ones share, three at a time.
    const alone = key === 'allemandes' ? codes.filter((c) => /^(PORSCHE|MERCEDES|BMW|AUDI)$/.test(c)) : [];
    const shared = codes.filter((c) => !alone.includes(c));
    const groups = [...alone.map((c) => [c]), ...Array.from({ length: Math.ceil(shared.length / 3) }, (_, i) => shared.slice(i * 3, i * 3 + 3))];
    // The other Fords the rules treat as American get a search of their own (a plain Ranger or Explorer would flood it).
    if (codes.includes('FORD:MUSTANG')) {
      const us: Record<string, string> = { 'FORD:GT': 'Ford GT', 'FORD:BRONCO': 'Ford Bronco', 'FORD:F-150': 'Ford F-150' };
      Object.entries(us).forEach(([c, n]) => names.set(c, n));
      groups.push(Object.keys(us));
    }
    for (const g of groups) {
      out.push({
        label: `${g.map((c) => names.get(c) ?? c).join(', ')}${floor ? ` à partir de ${floor.toLocaleString('fr-FR').replace(/[  ]/g, ' ')} €` : ''}`,
        url: base(`makesModelsCommercialNames=${encodeURIComponent(g.join(';'))}${floor ? `&priceMin=${floor}` : ''}`),
        brands: g, minPrice: floor || undefined,
      });
    }
  }
  if (oldest > 0) out.push({ label: `Collection : toutes marques jusqu’à ${oldest}`, url: base(`yearMax=${oldest}`), brands: [], maxYear: oldest });
  return out;
}
