import type { Family } from '../catalog/families.js';
import type { Settings } from '../settings/types.js';
import { render } from './render.js';
import { buildVars, type ListingForMessage, type VehicleForMessage } from './variables.js';

export type MessageSettings = Pick<Settings, 'dealer' | 'templates'>;

export interface VehicleOfFamily extends VehicleForMessage {
  readonly family: Family;
}

const stableHash = (seed: string): number => Array.from(seed).reduce((hash, character) => (hash * 31 + character.charCodeAt(0)) >>> 0, 0);

export function pickVariant(variants: readonly string[], seed: string): string {
  const written = variants.filter((variant) => variant.trim());
  if (written.length === 0) {
    return '';
  }
  return written[stableHash(seed) % written.length] ?? '';
}

const templateFamilyOf = (family: Family): Family => (family === 'autres' ? 'allemandes' : family);

export function composeMessage(
  listing: ListingForMessage,
  vehicle: VehicleOfFamily,
  settings: MessageSettings,
  seed: string,
  distanceKm: number | null,
): string {
  const template = pickVariant(settings.templates[templateFamilyOf(vehicle.family)].variants, seed);
  return render(template, buildVars(listing, vehicle, settings.dealer, distanceKm));
}
