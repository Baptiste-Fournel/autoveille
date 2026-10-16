import type { AccessStatusDependencies } from '../../application/auth/accessStatus.js';
import type { EnsureSecretsDependencies } from '../../application/auth/ensureSecrets.js';
import type { LoginDependencies } from '../../application/auth/login.js';
import type { SetupDependencies } from '../../application/auth/setup.js';
import type { RepairDependencies } from '../../application/ingest/repairVehicles.js';
import type { TestPushDependencies } from '../../application/notifications/sendTestPush.js';
import type { UpdateSettingsDependencies } from '../../application/settings/updateSettings.js';
import type { FetchHttpSitesDependencies, HttpSitesFetching } from '../../application/sources/fetchHttpSites.js';
import type { MailboxPolling, PollMailboxDependencies } from '../../application/sources/pollMailbox.js';
import type { SourcesOverviewDependencies } from '../../application/sources/sourcesOverview.js';

export type ApplicationPorts = PollMailboxDependencies &
  FetchHttpSitesDependencies &
  RepairDependencies &
  UpdateSettingsDependencies &
  SourcesOverviewDependencies &
  SetupDependencies &
  LoginDependencies &
  AccessStatusDependencies &
  EnsureSecretsDependencies &
  TestPushDependencies;

export interface PollingSources {
  readonly mailbox: MailboxPolling;
  readonly httpSites: HttpSitesFetching;
}

export interface WebDependencies {
  readonly ports: ApplicationPorts;
  readonly sources: PollingSources;
  readonly cookieSecret: string;
  readonly staticDirectory: string;
  readonly logging: boolean;
}
