import { ingestListing, type IngestOutcome as ListingIngested } from './application/ingest/ingestListing.js';
import { type RepairSummary, repairVehicles } from './application/ingest/repairVehicles.js';
import { messageFor } from './application/vehicles/messageFor.js';
import type { Store, VehicleRow } from './db.js';
import { describeRejection } from './domain/presentation/reasons.js';
import type { Settings } from './domain/settings/types.js';
import type { RawListing } from './domain/vehicle/types.js';
import { type IngestPorts, ingestPorts, type Notifications } from './legacyPorts.js';
import { legacyNotificationChannel } from './notify/notify.js';
import { vehicleOf } from './storeVehicleRepository.js';

export type IngestOutcome =
  | { kind: 'new'; vehicleId: number; matched: boolean; reasons: string[] }
  | { kind: 'price'; vehicleId: number; from: number; to: number }
  | { kind: 'seen'; vehicleId: number }
  | { kind: 'repost'; vehicleId: number }
  | { kind: 'other_site'; vehicleId: number };

const legacyOutcome = (outcome: ListingIngested): IngestOutcome => {
  switch (outcome.kind) {
    case 'created':
      return {
        kind: 'new',
        vehicleId: outcome.vehicleId,
        matched: outcome.verdict.pass,
        reasons: outcome.verdict.rejections.map(describeRejection),
      };
    case 'priceChanged':
      return { kind: 'price', vehicleId: outcome.vehicleId, from: outcome.from, to: outcome.to };
    case 'seenAgain':
      return { kind: 'seen', vehicleId: outcome.vehicleId };
    case 'attachedToVehicle':
      return { kind: outcome.attachment === 'repost' ? 'repost' : 'other_site', vehicleId: outcome.vehicleId };
  }
};

const withoutNotifications = (): Notifications => ({
  channel: legacyNotificationChannel(undefined, ''),
  address: { configuredBaseUrl: '', port: 0 },
});

export class Pipeline {
  private readonly ports: IngestPorts;

  private readonly notifies: boolean;

  constructor(store: Store, notifications?: Notifications) {
    this.ports = ingestPorts(store, notifications ?? withoutNotifications());
    this.notifies = notifications !== undefined;
  }

  messageFor(vehicle: VehicleRow, settings: Settings): string {
    return messageFor(this.ports, vehicleOf(vehicle), settings);
  }

  async ingest(raw: RawListing, settings: Settings = this.ports.settings.load(), opts: { notify?: boolean } = {}): Promise<IngestOutcome> {
    const outcome = await ingestListing(this.ports, { listing: raw, settings, notify: this.notifies && opts.notify !== false });
    return legacyOutcome(outcome);
  }

  repair(settings: Settings): Promise<RepairSummary> {
    return repairVehicles({ ...this.ports, settings: { load: () => settings, save: (next) => this.ports.settings.save(next) } });
  }
}
