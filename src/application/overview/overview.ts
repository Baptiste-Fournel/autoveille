import { isMailboxConfigured } from '../../domain/settings/mailboxConfigured.js';
import type { Dealer, Settings, Zone } from '../../domain/settings/types.js';
import { type AlertMismatch, alertMismatch } from '../../domain/sites/confirmations.js';
import { daysBefore } from '../../domain/time/daysBefore.js';
import { pushPublicKey } from '../notifications/subscriptions.js';
import type { Clock } from '../ports/clock.js';
import type { SecretStore } from '../ports/secretStore.js';
import type { SettingsRepository } from '../ports/settingsRepository.js';
import type { SourceRun, SourceRunRepository } from '../ports/sourceRunRepository.js';
import type { Activity, StatusCounts, VehicleRepository } from '../ports/vehicleRepository.js';

const WEEK_DAYS = 7;

export interface AlertIssue {
  readonly site: string;
  readonly mismatch: AlertMismatch;
}

export interface Overview {
  readonly counts: StatusCounts & { readonly today: number };
  readonly week: Activity;
  readonly dealer: Dealer;
  readonly zone: Pick<Zone, 'city' | 'radiusKm'>;
  readonly imapConfigured: boolean;
  readonly alertsDone: readonly string[];
  readonly alertIssues: readonly AlertIssue[];
  readonly sources: readonly SourceRun[];
  readonly pushKey: string | undefined;
}

export interface OverviewPorts {
  readonly vehicles: Pick<VehicleRepository, 'countsByStatus' | 'activitySince'>;
  readonly settings: Pick<SettingsRepository, 'load'>;
  readonly secrets: Pick<SecretStore, 'get'>;
  readonly sourceRuns: Pick<SourceRunRepository, 'all'>;
  readonly clock: Clock;
}

const alertIssuesOf = (settings: Settings): readonly AlertIssue[] =>
  Object.values(settings.alerts).flatMap((alert) => alertMismatch(alert, settings).map((mismatch) => ({ site: alert.site, mismatch })));

const checkedSites = (alertsDone: Settings['alertsDone']): readonly string[] =>
  Object.entries(alertsDone)
    .filter(([, done]) => done)
    .map(([site]) => site);

export function overview(ports: OverviewPorts): Overview {
  const settings = ports.settings.load();
  const counts = { ...ports.vehicles.countsByStatus(), today: ports.vehicles.activitySince(ports.clock.startOfToday()).received };
  return {
    counts,
    week: ports.vehicles.activitySince(daysBefore(ports.clock.now(), WEEK_DAYS)),
    dealer: settings.dealer,
    zone: { city: settings.zone.city, radiusKm: settings.zone.radiusKm },
    imapConfigured: isMailboxConfigured(settings.imap),
    alertsDone: checkedSites(settings.alertsDone),
    alertIssues: alertIssuesOf(settings),
    sources: ports.sourceRuns.all(),
    pushKey: pushPublicKey(ports),
  };
}
