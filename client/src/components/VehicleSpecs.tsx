import type { JSX } from 'preact';
import type { VehicleDto } from '../../../src/shared/api';
import { formatInteger } from '../format/integer';

const UNKNOWN = '–';

const priceDropped = (vehicle: VehicleDto): boolean => (vehicle.listings[0]?.priceHistory.length ?? 0) > 1;

export const VehicleSpecs = ({ vehicle }: { readonly vehicle: VehicleDto }): JSX.Element => (
  <div class="specs">
    <div>
      <b>{vehicle.year || UNKNOWN}</b>
      <span>année</span>
    </div>
    <div>
      <b>{vehicle.km !== null ? formatInteger(vehicle.km) : UNKNOWN}</b>
      <span>km</span>
    </div>
    <div>
      <b>{vehicle.price !== null ? `${formatInteger(vehicle.price)} €` : UNKNOWN}</b>
      <span>{priceDropped(vehicle) ? 'prix (baissé)' : 'prix'}</span>
    </div>
  </div>
);
