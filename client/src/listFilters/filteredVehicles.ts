import type { VehicleDto } from '../../../src/shared/api';
import { foldForSearch } from '../format/foldForSearch';
import { shownDate } from '../format/vehicleDate';
import type { ListFilters } from './listFilters';

const searchedText = (vehicle: VehicleDto): string =>
  foldForSearch(
    `${vehicle.name} ${vehicle.title} ${vehicle.city || ''} ${vehicle.siteLabel} ${vehicle.note || ''} ${vehicle.familyLabel || ''}`,
  );

const lastWhenUnknown = (value: number | null): number => (value === null ? Number.POSITIVE_INFINITY : value);

const keeps = (vehicle: VehicleDto, filters: ListFilters, query: string): boolean => {
  if (query && !searchedText(vehicle).includes(query)) {
    return false;
  }
  if (filters.families.length && !filters.families.includes(vehicle.family)) {
    return false;
  }
  if (filters.sites.length && !filters.sites.includes(vehicle.siteLabel)) {
    return false;
  }
  if (filters.priceMin && !(vehicle.price !== null && vehicle.price >= filters.priceMin)) {
    return false;
  }
  if (filters.priceMax && !(vehicle.price !== null && vehicle.price <= filters.priceMax)) {
    return false;
  }
  if (filters.distMax && !(vehicle.distanceKm !== null && vehicle.distanceKm <= filters.distMax)) {
    return false;
  }
  return true;
};

const order = (filters: ListFilters): ((a: VehicleDto, b: VehicleDto) => number) => {
  switch (filters.sort) {
    case 'priceDesc':
      return (a, b) => (b.price ?? -1) - (a.price ?? -1);
    case 'priceAsc':
      return (a, b) => lastWhenUnknown(a.price) - lastWhenUnknown(b.price);
    case 'near':
      return (a, b) => lastWhenUnknown(a.distanceKm) - lastWhenUnknown(b.distanceKm);
    case 'kmAsc':
      return (a, b) => lastWhenUnknown(a.km) - lastWhenUnknown(b.km);
    default:
      return (a, b) => new Date(shownDate(b)).getTime() - new Date(shownDate(a)).getTime();
  }
};

export const filteredVehicles = (vehicles: readonly VehicleDto[], filters: ListFilters, search: string): readonly VehicleDto[] => {
  const query = foldForSearch(search);
  return vehicles.filter((vehicle) => keeps(vehicle, filters, query)).sort(order(filters));
};
