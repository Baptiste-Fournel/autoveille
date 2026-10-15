import { type ImportedPublicationDate, type PublicationDate, publicationDateFromImport } from '../../domain/ingest/imports.js';
import { earlierPublishedAt } from '../../domain/vehicle/earlierPublishedAt.js';
import type { Clock } from '../ports/clock.js';
import type { Transaction } from '../ports/transaction.js';
import type { VehicleRepository } from '../ports/vehicleRepository.js';

export interface PublishedDatesDependencies {
  readonly vehicles: VehicleRepository;
  readonly transaction: Transaction;
  readonly clock: Clock;
}

export interface PublishedDatesSummary {
  readonly received: number;
  readonly updated: number;
  readonly unknown: number;
  readonly skipped: number;
}

export class NoDateToRecord extends Error {
  constructor() {
    super('no date to record');
    this.name = 'NoDateToRecord';
  }
}

export const PUBLISHED_DATES_LIMIT = 1000;

type DateResult = 'updated' | 'unknown' | 'skipped';

const writtenDate = ({ vehicles, transaction }: PublishedDatesDependencies, date: PublicationDate): DateResult => {
  const known = vehicles.findListing(date.site, date.externalId);
  if (known === undefined) {
    return 'unknown';
  }
  const vehiclePublishedAt = earlierPublishedAt(known.vehicle.publishedAt, date.publishedAt);
  transaction.run(() => {
    vehicles.recordListingSighting(known.listing.id, { publishedAt: date.publishedAt });
    if (vehiclePublishedAt !== undefined) {
      vehicles.recordVehicleSighting(known.vehicle.id, { publishedAt: vehiclePublishedAt });
    }
  });
  return 'updated';
};

const recorded = (dependencies: PublishedDatesDependencies, item: ImportedPublicationDate): DateResult => {
  const date = publicationDateFromImport(item, dependencies.clock.now());
  return date === undefined ? 'skipped' : writtenDate(dependencies, date);
};

export function recordPublishedDates(
  dependencies: PublishedDatesDependencies,
  items: readonly ImportedPublicationDate[],
): PublishedDatesSummary {
  const accepted = items.slice(0, PUBLISHED_DATES_LIMIT);
  if (accepted.length === 0) {
    throw new NoDateToRecord();
  }
  const results = accepted.map((item) => recorded(dependencies, item));
  const count = (result: DateResult): number => results.filter((candidate) => candidate === result).length;
  return { received: accepted.length, updated: count('updated'), unknown: count('unknown'), skipped: count('skipped') };
}
