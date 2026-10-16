import type { JSX } from 'preact';
import { useState } from 'preact/hooks';
import type { VehicleDto } from '../../../src/shared/api';
import { useAppState } from '../app/AppContext';
import { plural } from '../format/plural';
import { activeFilterCount, DEFAULT_LIST_FILTERS, type ListFilters, SORT_OPTIONS } from '../listFilters/listFilters';
import { DistanceRange } from './DistanceRange';
import { Icon } from './Icon';
import { PriceRange } from './PriceRange';

const SEARCH_FROM_COUNT = 4;

const SEARCH_PLACEHOLDER = 'Rechercher : modèle, marque, ville…';

interface ChipRowProps<Key extends string> {
  readonly label: string;
  readonly options: readonly (readonly [Key, string])[];
  readonly isOn: (key: Key) => boolean;
  readonly onPick: (key: Key) => void;
}

const ChipRow = <Key extends string>({ label, options, isOn, onPick }: ChipRowProps<Key>): JSX.Element => (
  <div class="frow">
    <span class="flabel">{label}</span>
    <div class="filterbar">
      {options.map(([key, text]) => (
        <button key={key} class="chip" type="button" aria-pressed={isOn(key)} onClick={() => onPick(key)}>
          {text}
        </button>
      ))}
    </div>
  </div>
);

const toggled = (keys: readonly string[], key: string): readonly string[] =>
  keys.includes(key) ? keys.filter((kept) => kept !== key) : [...keys, key];

const familiesIn = (vehicles: readonly VehicleDto[]): readonly (readonly [string, string])[] =>
  Array.from(new Map(vehicles.map((vehicle) => [vehicle.family, vehicle.familyLabel])).entries()).filter(([family]) => family);

const sitesIn = (vehicles: readonly VehicleDto[]): readonly (readonly [string, string])[] =>
  Array.from(new Set(vehicles.map((vehicle) => vehicle.siteLabel)))
    .filter(Boolean)
    .map((site) => [site, site] as const);

const distancesIn = (vehicles: readonly VehicleDto[]): readonly number[] =>
  vehicles.map((vehicle) => vehicle.distanceKm).filter((distance): distance is number => distance !== null);

const countText = (shown: number, loaded: number): string =>
  shown !== loaded ? `${shown} sur ${plural(loaded, 'annonce', 'annonces')}` : '';

export interface FilterBarProps {
  readonly vehicles: readonly VehicleDto[];
  readonly filters: ListFilters;
  readonly onFilters: (filters: ListFilters) => void;
  readonly shownCount: number;
}

export const FilterBar = ({ vehicles, filters, onFilters, shownCount }: FilterBarProps): JSX.Element => {
  const { preferences, vehicles: lists } = useAppState();
  const active = activeFilterCount(filters);
  const [open, setOpen] = useState(() => preferences.get('filters_open') === '1' || active > 0);
  const families = familiesIn(vehicles);
  const sites = sitesIn(vehicles);
  const distances = distancesIn(vehicles);

  const toggleOpen = (): void => {
    setOpen(!open);
    preferences.set('filters_open', open ? '0' : '1');
  };

  return (
    <div class="tools">
      <div class="toolbar">
        {vehicles.length >= SEARCH_FROM_COUNT ? (
          <div class="searchbox">
            <Icon name="search" />
            <input
              class="input"
              type="search"
              placeholder={SEARCH_PLACEHOLDER}
              value={lists.search.value}
              aria-label="Rechercher dans la liste"
              onInput={(event) => {
                lists.search.value = event.currentTarget.value;
              }}
            />
          </div>
        ) : null}
        <button class="btn" type="button" aria-expanded={open} onClick={toggleOpen}>
          <Icon name="sliders" />
          Filtres
          {active ? <span class="badge count">{active}</span> : null}
        </button>
      </div>
      <div class={open ? 'filters' : 'filters hidden'}>
        <ChipRow
          label="Trier"
          options={SORT_OPTIONS}
          isOn={(key) => filters.sort === key}
          onPick={(sort) => onFilters({ ...filters, sort })}
        />
        {families.length > 1 ? (
          <ChipRow
            label="Famille"
            options={families}
            isOn={(key) => filters.families.includes(key)}
            onPick={(key) => onFilters({ ...filters, families: toggled(filters.families, key) })}
          />
        ) : null}
        {sites.length > 1 ? (
          <ChipRow
            label="Site"
            options={sites}
            isOn={(key) => filters.sites.includes(key)}
            onPick={(key) => onFilters({ ...filters, sites: toggled(filters.sites, key) })}
          />
        ) : null}
        <PriceRange vehicles={vehicles} filters={filters} onFilters={onFilters} />
        {distances.length ? <DistanceRange distances={distances} filters={filters} onFilters={onFilters} /> : null}
        <div class="row between">
          <p class="muted small count-line">{countText(shownCount, vehicles.length)}</p>
          <button
            class={active ? 'btn quiet small' : 'btn quiet small hidden'}
            type="button"
            onClick={() => onFilters(DEFAULT_LIST_FILTERS)}
          >
            Tout réinitialiser
          </button>
        </div>
      </div>
    </div>
  );
};
