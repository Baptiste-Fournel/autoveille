import type { JSX } from 'preact';
import type { ListFilters } from '../listFilters/listFilters';

const DISTANCE_STEP = 10;

const LOWEST_TOP = 50;

const distanceTopOf = (distances: readonly number[]): number =>
  Math.max(LOWEST_TOP, Math.ceil((Math.max(0, ...distances) + DISTANCE_STEP) / DISTANCE_STEP) * DISTANCE_STEP);

const reachText = (distance: number, top: number): string => (distance >= top ? 'toute la zone' : `jusqu’à ${distance} km`);

export interface DistanceRangeProps {
  readonly distances: readonly number[];
  readonly filters: ListFilters;
  readonly onFilters: (filters: ListFilters) => void;
}

export const DistanceRange = ({ distances, filters, onFilters }: DistanceRangeProps): JSX.Element => {
  const top = distanceTopOf(distances);
  const reach = Math.min(filters.distMax || top, top);
  return (
    <div class="frow slider-row">
      <span class="flabel">Distance</span>
      <div class="range1">
        <input
          class="slider"
          type="range"
          min={DISTANCE_STEP}
          max={top}
          step={DISTANCE_STEP}
          value={reach}
          aria-label="Distance maximum"
          onInput={(event) => {
            const distance = Number(event.currentTarget.value);
            onFilters({ ...filters, distMax: distance < top ? distance : null });
          }}
        />
      </div>
      <span class="fval">{reachText(reach, top)}</span>
    </div>
  );
};
