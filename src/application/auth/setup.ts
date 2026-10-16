import { rememberPublicAddress } from '../notifications/publicAddress.js';
import type { PasswordHasher } from '../ports/passwordHasher.js';
import type { SecretStore } from '../ports/secretStore.js';
import type { Session } from '../ports/sessionRepository.js';
import type { AttemptLimiter } from './attemptLimiter.js';
import { AuthenticationRefused } from './authenticationRefused.js';
import { openSession, type SessionOpeningDependencies } from './session.js';

const MIN_PASSWORD_LENGTH = 8;

const THIS_MACHINE_ADDRESSES: readonly string[] = ['127.0.0.1', '::1', '::ffff:127.0.0.1'];

export interface SetupDependencies extends SessionOpeningDependencies {
  readonly secrets: SecretStore;
  readonly passwordHasher: PasswordHasher;
  readonly attempts: AttemptLimiter;
  readonly configuredSetupCode: string;
  readonly configuredBaseUrl: string;
}

export interface FirstSignIn {
  readonly setupCode: string;
  readonly password: string;
  readonly clientAddress: string;
  readonly origin: string;
}

export const setup = (dependencies: SetupDependencies, request: FirstSignIn): Session => {
  const { secrets, attempts, configuredSetupCode } = dependencies;
  if (secrets.get('password_hash')) {
    throw new AuthenticationRefused('passwordAlreadyChosen');
  }
  const key = `setup:${request.clientAddress}`;
  if (attempts.blocked(key)) {
    throw new AuthenticationRefused('tooManyAttempts');
  }
  const allowed = configuredSetupCode
    ? request.setupCode.trim() === configuredSetupCode
    : THIS_MACHINE_ADDRESSES.includes(request.clientAddress);
  if (!allowed) {
    attempts.fail(key);
    throw new AuthenticationRefused('wrongSetupCode');
  }
  if (request.password.length < MIN_PASSWORD_LENGTH) {
    throw new AuthenticationRefused('passwordTooShort');
  }
  secrets.set('password_hash', dependencies.passwordHasher.hash(request.password));
  attempts.reset(key);
  rememberPublicAddress(secrets, dependencies.configuredBaseUrl, request.origin);
  return openSession(dependencies);
};
