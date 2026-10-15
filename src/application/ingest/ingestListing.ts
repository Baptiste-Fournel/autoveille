import type { Verdict } from '../../domain/filtering/verdict.js';
import { type Created, decideIngest, type IngestDecision, type PriceChanged } from '../../domain/ingest/decide.js';
import { type Attachment, type Identification, sameVehicleAmong } from '../../domain/ingest/identify.js';
import { notificationFor } from '../../domain/ingest/notifications.js';
import { extractionContextAt } from '../../domain/parsing/extractionContext.js';
import { extractVehicleInfo } from '../../domain/parsing/vehicleInfo.js';
import type { Settings } from '../../domain/settings/types.js';
import { EVENT_TYPES } from '../../domain/vehicle/events.js';
import { fingerprint } from '../../domain/vehicle/identity.js';
import type { PricePoint, RawListing, VehicleInfo } from '../../domain/vehicle/types.js';
import { notifyNewVehicle } from '../notifications/notifyNewVehicle.js';
import { notifyPriceDrop } from '../notifications/notifyPriceDrop.js';
import type { NotificationDependencies } from '../notifications/sendToChannels.js';
import type { Clock } from '../ports/clock.js';
import type { Geocoder } from '../ports/geocoder.js';
import type { Transaction } from '../ports/transaction.js';
import type { VehicleRepository } from '../ports/vehicleRepository.js';
import { locateListing } from './listingLocation.js';

export interface IngestDependencies extends NotificationDependencies {
  readonly vehicles: VehicleRepository;
  readonly transaction: Transaction;
  readonly geocoder: Geocoder;
  readonly clock: Clock;
}

export interface ListingToIngest {
  readonly listing: RawListing;
  readonly settings: Settings;
  readonly notify: boolean;
}

export type IngestOutcome =
  | { readonly kind: 'created'; readonly vehicleId: number; readonly verdict: Verdict }
  | { readonly kind: 'priceChanged'; readonly vehicleId: number; readonly from: number; readonly to: number }
  | { readonly kind: 'seenAgain'; readonly vehicleId: number }
  | { readonly kind: 'attachedToVehicle'; readonly vehicleId: number; readonly attachment: Attachment };

const identify = async (
  dependencies: IngestDependencies,
  listing: RawListing,
  info: VehicleInfo,
  settings: Settings,
): Promise<Identification> => {
  const known = dependencies.vehicles.findListing(listing.site, listing.externalId);
  if (known !== undefined) {
    return { kind: 'knownListing', listing: known.listing, vehicle: known.vehicle };
  }
  const vehicle = sameVehicleAmong(dependencies.vehicles.vehiclesWithFingerprint(fingerprint(info, listing)), info);
  if (vehicle !== undefined) {
    return { kind: 'knownVehicle', vehicle, listings: dependencies.vehicles.listingsOf(vehicle.id) };
  }
  return { kind: 'newVehicle', location: await locateListing(dependencies.geocoder, settings.zone, listing) };
};

const addFirstPricePoint = (vehicles: VehicleRepository, listingId: number, pricePoint: PricePoint | undefined): void => {
  if (pricePoint !== undefined) {
    vehicles.addPricePoint(listingId, pricePoint);
  }
};

const applied = (vehicles: VehicleRepository, decision: IngestDecision): number => {
  switch (decision.kind) {
    case 'priceChanged':
      vehicles.addPricePoint(decision.listingId, decision.pricePoint);
      vehicles.recordListingSighting(decision.listingId, decision.listingChanges);
      vehicles.recordVehicleSighting(decision.vehicleId, decision.vehicleChanges);
      vehicles.addEvent(decision.vehicleId, decision.event);
      return decision.vehicleId;
    case 'seenAgain':
      vehicles.recordListingSighting(decision.listingId, decision.listingChanges);
      vehicles.recordVehicleSighting(decision.vehicleId, decision.vehicleChanges);
      return decision.vehicleId;
    case 'attachedToVehicle': {
      const listingId = vehicles.addListing(decision.vehicleId, decision.newListing);
      addFirstPricePoint(vehicles, listingId, decision.pricePoint);
      vehicles.recordVehicleSighting(decision.vehicleId, decision.vehicleChanges);
      vehicles.addEvent(decision.vehicleId, decision.event);
      return decision.vehicleId;
    }
    case 'created': {
      const vehicleId = vehicles.addVehicle(decision.vehicle);
      const listingId = vehicles.addListing(vehicleId, decision.newListing);
      addFirstPricePoint(vehicles, listingId, decision.pricePoint);
      vehicles.addEvent(vehicleId, decision.event);
      return vehicleId;
    }
  }
};

const recordFailure = (dependencies: IngestDependencies, vehicleId: number, error: unknown): void => {
  dependencies.vehicles.addEvent(vehicleId, { type: EVENT_TYPES.notificationFailed, detail: String(error), at: dependencies.clock.now() });
};

const announceNewVehicle = async (dependencies: IngestDependencies, decision: Created, vehicleId: number): Promise<void> => {
  try {
    await notifyNewVehicle(dependencies, { vehicle: { id: vehicleId, ...decision.vehicle }, listing: decision.listing });
    dependencies.vehicles.markNotified(vehicleId, dependencies.clock.now());
  } catch (error) {
    recordFailure(dependencies, vehicleId, error);
  }
};

const announcePriceDrop = async (dependencies: IngestDependencies, decision: PriceChanged): Promise<void> => {
  try {
    await notifyPriceDrop(dependencies, { vehicle: decision.vehicle, listing: decision.listing, from: decision.from, to: decision.to });
  } catch (error) {
    recordFailure(dependencies, decision.vehicleId, error);
  }
};

const announce = async (dependencies: IngestDependencies, decision: IngestDecision, vehicleId: number): Promise<void> => {
  const notification = notificationFor(decision);
  if (decision.kind === 'created' && notification === 'newVehicle') {
    await announceNewVehicle(dependencies, decision, vehicleId);
  }
  if (decision.kind === 'priceChanged' && notification === 'priceDrop') {
    await announcePriceDrop(dependencies, decision);
  }
};

const outcomeOf = (decision: IngestDecision, vehicleId: number): IngestOutcome => {
  switch (decision.kind) {
    case 'created':
      return { kind: 'created', vehicleId, verdict: decision.verdict };
    case 'priceChanged':
      return { kind: 'priceChanged', vehicleId, from: decision.from, to: decision.to };
    case 'seenAgain':
      return { kind: 'seenAgain', vehicleId };
    case 'attachedToVehicle':
      return { kind: 'attachedToVehicle', vehicleId, attachment: decision.attachment };
  }
};

export async function ingestListing(dependencies: IngestDependencies, request: ListingToIngest): Promise<IngestOutcome> {
  const { listing, settings } = request;
  const now = dependencies.clock.now();
  const info = extractVehicleInfo(listing, extractionContextAt(settings, now));
  const identification = await identify(dependencies, listing, info, settings);
  const decision = decideIngest({ listing, info, settings, identification, now });
  const vehicleId = dependencies.transaction.run(() => applied(dependencies.vehicles, decision));
  if (request.notify) {
    await announce(dependencies, decision, vehicleId);
  }
  return outcomeOf(decision, vehicleId);
}
