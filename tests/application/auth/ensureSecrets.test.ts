import { describe, expect, it } from 'vitest';
import { type EnsureSecretsDependencies, ensureSecrets } from '../../../src/application/auth/ensureSecrets.js';
import { FAKE_PUSH_KEYS, fakePushKeyGenerator } from '../../fakes/fakePushKeyGenerator.js';
import { authenticationFakes, OWNER_PASSWORD, OWNER_PASSWORD_HASH } from '../../support/authentication.js';

const COOKIE_SECRET = 'c0ffee1234567890c0ffee1234567890c0ffee1234567890c0ffee1234567890';

const ESTABLISHED_PUSH_KEYS = {
  publicKey: 'BEstablishedVapidPublicKeyForTestsOnly000000000000000000000000000000000000000000000000',
  privateKey: 'established-vapid-private-key-for-tests-only',
};

const firstStart = (configuredAppPassword = ''): EnsureSecretsDependencies => ({
  ...authenticationFakes(),
  pushKeyGenerator: fakePushKeyGenerator(),
  configuredAppPassword,
});

describe('secrets de l’application au démarrage', () => {
  it('au premier démarrage, le secret des cookies et les clés des notifications sont créés', () => {
    // Given
    const dependencies = firstStart();

    // When
    const secrets = ensureSecrets(dependencies);

    // Then
    expect(secrets).toEqual({ cookieSecret: '01'.padStart(64, '0'), pushKeys: FAKE_PUSH_KEYS });
    expect(dependencies.secrets.get('cookie_secret')).toBe(secrets.cookieSecret);
    expect(dependencies.secrets.get('vapid_public')).toBe(FAKE_PUSH_KEYS.publicKey);
    expect(dependencies.secrets.get('vapid_private')).toBe(FAKE_PUSH_KEYS.privateKey);
    expect(dependencies.secrets.get('password_hash')).toBeUndefined();
  });

  it('au redémarrage, les secrets déjà créés sont gardés : les cookies et les abonnements des téléphones restent valables', () => {
    // Given
    const dependencies: EnsureSecretsDependencies = {
      ...authenticationFakes({
        cookie_secret: COOKIE_SECRET,
        vapid_public: ESTABLISHED_PUSH_KEYS.publicKey,
        vapid_private: ESTABLISHED_PUSH_KEYS.privateKey,
      }),
      pushKeyGenerator: fakePushKeyGenerator(),
      configuredAppPassword: '',
    };

    // When
    const secrets = ensureSecrets(dependencies);

    // Then
    expect(secrets).toEqual({ cookieSecret: COOKIE_SECRET, pushKeys: ESTABLISHED_PUSH_KEYS });
  });

  it('avec APP_PASSWORD, le mot de passe imposé par l’environnement est enregistré au premier démarrage, sans première connexion', () => {
    // Given
    const dependencies = firstStart(OWNER_PASSWORD);

    // When
    ensureSecrets(dependencies);

    // Then
    expect(dependencies.secrets.get('password_hash')).toBe(OWNER_PASSWORD_HASH);
  });

  it('APP_PASSWORD ajouté après la mise en route ne remplace pas le mot de passe déjà choisi', () => {
    // Given
    const dependencies: EnsureSecretsDependencies = {
      ...authenticationFakes({ password_hash: OWNER_PASSWORD_HASH }),
      pushKeyGenerator: fakePushKeyGenerator(),
      configuredAppPassword: 'mot-de-passe-du-fichier-env',
    };

    // When
    ensureSecrets(dependencies);

    // Then
    expect(dependencies.secrets.get('password_hash')).toBe(OWNER_PASSWORD_HASH);
  });
});
