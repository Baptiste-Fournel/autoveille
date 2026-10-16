import type { SecretStore } from '../ports/secretStore.js';

export interface ImportTokenCheckDependencies {
  readonly secrets: SecretStore;
}

export const acceptsImportToken = ({ secrets }: ImportTokenCheckDependencies, candidate: string): boolean =>
  secrets.matches('import_token', candidate);
