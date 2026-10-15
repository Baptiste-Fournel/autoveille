import { rememberPublicAddress } from '../notifications/publicAddress.js';
import type { PasswordHasher } from '../ports/passwordHasher.js';
import type { SecretStore } from '../ports/secretStore.js';
import type { Session } from '../ports/sessionRepository.js';
import type { AttemptLimiter } from './attemptLimiter.js';
import { AuthenticationRefused } from './authenticationRefused.js';
import { openSession, type SessionOpeningDependencies } from './session.js';

export interface LoginDependencies extends SessionOpeningDependencies {
  readonly secrets: SecretStore;
  readonly passwordHasher: PasswordHasher;
  readonly attempts: AttemptLimiter;
  readonly configuredBaseUrl: string;
}

export interface SignIn {
  readonly password: string;
  readonly clientAddress: string;
  readonly origin: string;
}

export const login = (dependencies: LoginDependencies, request: SignIn): Session => {
  const { secrets, attempts } = dependencies;
  const key = `login:${request.clientAddress}`;
  if (attempts.blocked(key)) {
    throw new AuthenticationRefused('tooManyAttempts');
  }
  const hash = secrets.get('password_hash');
  if (!hash) {
    throw new AuthenticationRefused('passwordNotChosenYet');
  }
  if (!dependencies.passwordHasher.verify(request.password, hash)) {
    attempts.fail(key);
    throw new AuthenticationRefused('wrongPassword');
  }
  attempts.reset(key);
  rememberPublicAddress(secrets, dependencies.configuredBaseUrl, request.origin);
  return openSession(dependencies);
};
