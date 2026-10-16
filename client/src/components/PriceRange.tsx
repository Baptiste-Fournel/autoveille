import type { JSX, TargetedEvent } from 'preact';
import type { VehicleDto } from '../../../src/shared/api';
import { formatInteger } from '../format/integer';
import type { ListFilters } from '../listFilters/listFilters';

const PRICE_STEP = 2500;

const LOWEST_TOP = 50000;

const TOP_ROUNDING = 10000;

const priceTopOf = (vehicles: readonly VehicleDto[]): number => {
  const prices = vehicles.map((vehicle) => vehicle.price).filter((price): price is number => price !== null);
  return Math.max(LOWEST_TOP, Math.ceil((Math.max(0, ...prices) + PRICE_STEP) / TOP_ROUNDING) * TOP_ROUNDING);
};

const boundsText = (low: number, high: number, top: number): string =>
  `${low > 0 ? `${formatInteger(low)} €` : '0 €'} – ${high >= top ? 'sans limite' : `${formatInteger(high)} €`}`;

const trackBackground = (low: number, high: number, top: number): string => {
  const from = (low / top) * 100;
  const to = (high / top) * 100;
  return `linear-gradient(to right, var(--line-strong) ${from}%, var(--accent) ${from}%, var(--accent) ${to}%, var(--line-strong) ${to}%)`;
};

const sliderValue = (event: TargetedEvent<HTMLInputElement>): number => Number(event.currentTarget.value);

export interface PriceRangeProps {
  readonly vehicles: readonly VehicleDto[];
  readonly filters: ListFilters;
  readonly onFilters: (filters: ListFilters) => void;
}

export const PriceRange = ({ vehicles, filters, onFilters }: PriceRangeProps): JSX.Element => {
  const top = priceTopOf(vehicles);
  const low = Math.min(filters.priceMin || 0, top);
  const high = Math.min(filters.priceMax || top, top);
  const choose = (min: number, max: number): void =>
    onFilters({ ...filters, priceMin: min > 0 ? min : null, priceMax: max < top ? max : null });
  return (
    <div class="frow slider-row">
      <span class="flabel">Prix</span>
      <div class="range2">
        <div class="track" style={{ background: trackBackground(low, high, top) }} />
        <input
          type="range"
          min={0}
          max={top}
          step={PRICE_STEP}
          value={low}
          aria-label="Prix minimum"
          onInput={(event) => {
            const min = sliderValue(event);
            choose(min, Math.max(min, high));
          }}
        />
        <input
          type="range"
          min={0}
          max={top}
          step={PRICE_STEP}
          value={high}
          aria-label="Prix maximum"
          onInput={(event) => {
            const max = sliderValue(event);
            choose(Math.min(low, max), max);
          }}
        />
      </div>
      <span class="fval">{boundsText(low, high, top)}</span>
    </div>
  );
};
