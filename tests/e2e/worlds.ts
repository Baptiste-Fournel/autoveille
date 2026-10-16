import { OWNER_PASSWORD, SETUP_CODE } from '../support/authentication.js';

export interface E2eWorld {
  readonly port: number;
  readonly environment: Readonly<Record<string, string>>;
}

const dealershipWithDemoListings = (port: number): E2eWorld => ({ port, environment: { DEMO: '1', APP_PASSWORD: OWNER_PASSWORD } });

export const FIRST_VISIT: E2eWorld = { port: 4311, environment: { SETUP_CODE } };

export const DAILY_ROUTINE = dealershipWithDemoListings(4312);

export const REJECTED_LISTINGS = dealershipWithDemoListings(4313);

export const SETTINGS_PREVIEW = dealershipWithDemoListings(4314);

export const E2E_WORLDS: readonly E2eWorld[] = [FIRST_VISIT, DAILY_ROUTINE, REJECTED_LISTINGS, SETTINGS_PREVIEW];

export const READY_LINE = 'Parcours e2e : serveurs prêts sur les ports';

export const originOf = (world: E2eWorld): string => `http://127.0.0.1:${world.port}`;
