import { SITE_ALERT_HELP } from '../domain/presentation/siteHelp.js';
import { targetedSearchLabel } from '../domain/presentation/targetedSearches.js';
import { siteSetups as domainSiteSetups, targetedSearches as domainTargetedSearches } from '../domain/sites/alertSetup.js';
import type { Settings } from '../types.js';

export { alertBounds } from '../domain/sites/alertSetup.js';

export interface SiteSetup {
  key: string;
  label: string;
  searchUrl: string;
  prefilled: boolean;
  help: string;
  manageUrl?: string;
  alertRadiusKm: number;
  alertMaxKm: number;
}

export function siteSetups(settings: Settings): SiteSetup[] {
  return domainSiteSetups(settings).map((setup) => ({
    key: setup.key,
    label: setup.label,
    searchUrl: setup.searchUrl,
    prefilled: setup.prefilled,
    help: SITE_ALERT_HELP[setup.key],
    manageUrl: setup.manageUrl,
    alertRadiusKm: setup.alertRadiusKm,
    alertMaxKm: setup.alertMaxKm,
  }));
}

export interface TargetedSearch {
  label: string;
  url: string;
  brands: string[];
  minPrice?: number;
  maxYear?: number;
}

export function targetedSearches(settings: Settings, site = 'lacentrale'): TargetedSearch[] {
  return domainTargetedSearches(settings, site).map((search) =>
    search.kind === 'collection'
      ? { label: targetedSearchLabel(search), url: search.url, brands: [], maxYear: search.maxYear }
      : { label: targetedSearchLabel(search), url: search.url, brands: [...search.brands], minPrice: search.minPrice },
  );
}
