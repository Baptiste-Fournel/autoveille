import { storedPushKeys } from '../notifications/storedPushKeys.js';
import type { PasswordHasher } from '../ports/passwordHasher.js';
import type { PushKeyGenerator, PushKeyPair } from '../ports/pushKeyGenerator.js';
import { type SecretCreationDependencies, secretCreatedOnFirstUse } from './secretCreatedOnFirstUse.js';

const COOKIE_SECRET_BYTES = 32;

export interface EnsureSecretsDependencies extends SecretCreationDependencies {
  readonly pushKeyGenerator: PushKeyGenerator;
  readonly passwordHasher: PasswordHasher;
  readonly configuredAppPassword: string;
}

export interface ApplicationSecrets {
  readonly cookieSecret: string;
  readonly pushKeys: PushKeyPair | undefined;
}

export const ensureSecrets = (dependencies: EnsureSecretsDependencies): ApplicationSecrets => {
  const { secrets, configuredAppPassword } = dependencies;
  const cookieSecret = secretCreatedOnFirstUse(dependencies, 'cookie_secret', COOKIE_SECRET_BYTES);
  if (!secrets.get('vapid_public')) {
    const generated = dependencies.pushKeyGenerator.generateKeyPair();
    secrets.set('vapid_public', generated.publicKey);
    secrets.set('vapid_private', generated.privateKey);
  }
  if (configuredAppPassword && !secrets.get('password_hash')) {
    secrets.set('password_hash', dependencies.passwordHasher.hash(configuredAppPassword));
  }
  return { cookieSecret, pushKeys: storedPushKeys(secrets) };
};
