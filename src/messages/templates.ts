import { composeMessage as composeFromListing, pickVariant as pickWrittenVariant } from '../domain/messaging/compose.js';
import { lintTemplate as findTemplateWarnings } from '../domain/messaging/lint.js';
import { buildVars as buildMessageVars, type MessageVars } from '../domain/messaging/variables.js';
import { TEMPLATE_WARNING_TEXTS } from '../domain/presentation/templateWarnings.js';
import type { Family, RawListing, Settings, VehicleInfo } from '../types.js';

export { render } from '../domain/messaging/render.js';
export type { MessageVars } from '../domain/messaging/variables.js';
export { VARIABLE_HELP } from '../domain/presentation/variableHelp.js';

export function buildVars(raw: RawListing, info: VehicleInfo, settings: Settings, distanceKm?: number | null): MessageVars {
  return buildMessageVars(raw, info, settings.dealer, distanceKm ?? null);
}

export function composeMessage(raw: RawListing, info: VehicleInfo, settings: Settings, seed: string, distanceKm?: number | null): string {
  return composeFromListing(raw, info, settings, seed, distanceKm ?? null);
}

export function pickVariant(family: Family, settings: Settings, seed: string): string {
  return pickWrittenVariant(settings.templates[family]?.variants ?? [], seed);
}

export function lintTemplate(text: string): string[] {
  return findTemplateWarnings(text).map((warning) => TEMPLATE_WARNING_TEXTS[warning]);
}
