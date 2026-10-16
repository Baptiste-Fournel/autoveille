import type { SecretStore } from '../ports/secretStore.js';
import { type SessionDependencies, validateSession } from './session.js';

export interface AccessStatusDependencies extends SessionDependencies {
  readonly secrets: SecretStore;
  readonly configuredSetupCode: string;
}

export interface AccessStatus {
  readonly authenticated: boolean;
  readonly needsSetup: boolean;
  readonly setupCodeRequired: boolean;
}

export const accessStatus = (dependencies: AccessStatusDependencies, token: string | undefined): AccessStatus => ({
  authenticated: token !== undefined && validateSession(dependencies, token),
  needsSetup: !dependencies.secrets.get('password_hash'),
  setupCodeRequired: Boolean(dependencies.configuredSetupCode),
});
