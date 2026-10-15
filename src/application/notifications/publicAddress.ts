import type { SecretStore } from '../ports/secretStore.js';

export interface PublicAddressSettings {
  readonly configuredBaseUrl: string;
  readonly port: number;
}

export const publicAddress = (secrets: SecretStore, settings: PublicAddressSettings): string =>
  settings.configuredBaseUrl || secrets.get('base_url') || `http://localhost:${settings.port}`;

export const rememberPublicAddress = (secrets: SecretStore, configuredBaseUrl: string, origin: string): void => {
  if (!configuredBaseUrl && !secrets.get('base_url')) {
    secrets.set('base_url', origin);
  }
};
