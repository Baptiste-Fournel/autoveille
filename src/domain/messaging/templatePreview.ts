import type { Family } from '../catalog/families.js';
import { type ExtractionContext, extractVehicleInfo } from '../parsing/vehicleInfo.js';
import type { Dealer } from '../settings/types.js';
import { rawListingOf } from '../vehicle/rawListingOf.js';
import type { Listing, RawListing, Vehicle } from '../vehicle/types.js';
import { lintTemplate, type TemplateWarning } from './lint.js';
import { render } from './render.js';
import { SAMPLE_DISTANCE_KM, SAMPLE_LISTINGS } from './sampleListings.js';
import { buildVars } from './variables.js';

export interface PreviewSubject {
  readonly listing: RawListing;
  readonly distanceKm: number | null;
}

export interface TemplatePreview {
  readonly text: string;
  readonly warnings: readonly TemplateWarning[];
}

export const sampleSubject = (family: Family): PreviewSubject => ({ listing: SAMPLE_LISTINGS[family], distanceKm: SAMPLE_DISTANCE_KM });

export const vehicleSubject = (vehicle: Vehicle, firstListing: Listing): PreviewSubject => ({
  listing: rawListingOf(vehicle, firstListing),
  distanceKm: vehicle.distanceKm,
});

export const renderTemplatePreview = (
  template: string,
  subject: PreviewSubject,
  dealer: Dealer,
  context: ExtractionContext,
): TemplatePreview => ({
  text: render(template, buildVars(subject.listing, extractVehicleInfo(subject.listing, context), dealer, subject.distanceKm)),
  warnings: lintTemplate(template),
});
