import type { VehicleDto } from '../../../src/shared/api';
import { ago } from './ago';

export const shownDate = (vehicle: Pick<VehicleDto, 'publishedAt' | 'firstSeenAt'>): string => vehicle.publishedAt || vehicle.firstSeenAt;

export const whenText = (vehicle: Pick<VehicleDto, 'publishedAt' | 'firstSeenAt'>, now: number): string =>
  vehicle.publishedAt ? `publiée ${ago(vehicle.publishedAt, now)}` : `reçue ${ago(vehicle.firstSeenAt, now)}`;
