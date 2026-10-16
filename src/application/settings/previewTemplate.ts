import type { Family } from '../../domain/catalog/families.js';
import {
  type PreviewSubject,
  renderTemplatePreview,
  sampleSubject,
  type TemplatePreview,
  vehicleSubject,
} from '../../domain/messaging/templatePreview.js';
import { extractionContextAt } from '../../domain/parsing/extractionContext.js';
import type { Settings } from '../../domain/settings/types.js';
import type { Clock } from '../ports/clock.js';
import type { SettingsRepository } from '../ports/settingsRepository.js';
import type { VehicleRepository } from '../ports/vehicleRepository.js';

export interface TemplatePreviewRequest {
  readonly family?: Family;
  readonly text?: string;
  readonly vehicleId?: number;
}

export interface PreviewTemplateDependencies {
  readonly settings: SettingsRepository;
  readonly vehicles: Pick<VehicleRepository, 'vehicle' | 'listingsOf'>;
  readonly clock: Clock;
}

const DEFAULT_FAMILY: Family = 'allemandes';

const firstTemplateOf = (settings: Settings, family: Family): string => settings.templates[family].variants[0] ?? '';

const receivedVehicleSubject = (vehicles: PreviewTemplateDependencies['vehicles'], vehicleId: number): PreviewSubject | undefined => {
  const vehicle = vehicles.vehicle(vehicleId);
  const firstListing = vehicle === undefined ? undefined : vehicles.listingsOf(vehicle.id)[0];
  return vehicle === undefined || firstListing === undefined ? undefined : vehicleSubject(vehicle, firstListing);
};

export const previewTemplate = (
  { settings, vehicles, clock }: PreviewTemplateDependencies,
  request: TemplatePreviewRequest,
): TemplatePreview => {
  const current = settings.load();
  const family = request.family ?? DEFAULT_FAMILY;
  const received = request.vehicleId === undefined ? undefined : receivedVehicleSubject(vehicles, request.vehicleId);
  return renderTemplatePreview(
    request.text ?? firstTemplateOf(current, family),
    received ?? sampleSubject(family),
    current.dealer,
    extractionContextAt(current, clock.now()),
  );
};
