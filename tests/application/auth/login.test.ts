import { describe, expect, it } from 'vitest';
import { type LoginDependencies, login } from '../../../src/application/auth/login.js';
import { FAKE_NOW } from '../../fakes/fakeClock.js';
import {
  type AuthenticationFakes,
  authenticationFakes,
  OWNER_PASSWORD,
  OWNER_PASSWORD_HASH,
  PHONE_ADDRESS,
  PUBLIC_ORIGIN,
  refusalOf,
} from '../../support/authentication.js';

const passwordChosen = (): LoginDependencies & AuthenticationFakes => ({
  ...authenticationFakes({ password_hash: OWNER_PASSWORD_HASH }),
  configuredBaseUrl: '',
});

describe('connexion', () => {
  it('le bon mot de passe ouvre une session de cent quatre-vingts jours sur un nouvel appareil', () => {
    // Given
    const dependencies = passwordChosen();

    // When
    const session = login(dependencies, { password: OWNER_PASSWORD, clientAddress: PHONE_ADDRESS, origin: PUBLIC_ORIGIN });

    // Then
    expect(session).toEqual({ token: '01'.padStart(64, '0'), createdAt: FAKE_NOW, expiresAt: '2027-04-13T08:30:00.000Z' });
    expect(dependencies.sessions.find(session.token)).toEqual(session);
  });

  it('un mauvais mot de passe est refusé', () => {
    // Given
    const dependencies = passwordChosen();

    // When
    const refusal = refusalOf(() =>
      login(dependencies, { password: 'garage-bordeaux-2025', clientAddress: PHONE_ADDRESS, origin: PUBLIC_ORIGIN }),
    );

    // Then
    expect(refusal).toBe('wrongPassword');
    expect(dependencies.sessions.find('01'.padStart(64, '0'))).toBeUndefined();
  });

  it('se connecter avant d’avoir choisi le mot de passe renvoie vers la première connexion', () => {
    // Given
    const dependencies: LoginDependencies = { ...authenticationFakes(), configuredBaseUrl: '' };

    // When
    const refusal = refusalOf(() => login(dependencies, { password: OWNER_PASSWORD, clientAddress: PHONE_ADDRESS, origin: PUBLIC_ORIGIN }));

    // Then
    expect(refusal).toBe('passwordNotChosenYet');
  });

  it('avec le mot de passe imposé par APP_PASSWORD, la première connexion retient l’adresse de l’application', () => {
    // Given
    const dependencies = passwordChosen();

    // When
    login(dependencies, { password: OWNER_PASSWORD, clientAddress: PHONE_ADDRESS, origin: PUBLIC_ORIGIN });

    // Then
    expect(dependencies.secrets.get('base_url')).toBe(PUBLIC_ORIGIN);
  });

  it('une connexion par une autre adresse ne remplace pas l’adresse retenue à la première connexion', () => {
    // Given
    const dependencies: LoginDependencies = {
      ...authenticationFakes({ password_hash: OWNER_PASSWORD_HASH, base_url: PUBLIC_ORIGIN }),
      configuredBaseUrl: '',
    };

    // When
    login(dependencies, { password: OWNER_PASSWORD, clientAddress: '192.168.1.24', origin: 'http://192.168.1.10:3000' });

    // Then
    expect(dependencies.secrets.get('base_url')).toBe(PUBLIC_ORIGIN);
  });

  it('avec BASE_URL configurée, une connexion ne retient pas son adresse', () => {
    // Given
    const dependencies: LoginDependencies = { ...passwordChosen(), configuredBaseUrl: PUBLIC_ORIGIN };

    // When
    login(dependencies, { password: OWNER_PASSWORD, clientAddress: PHONE_ADDRESS, origin: 'http://192.168.1.10:3000' });

    // Then
    expect(dependencies.secrets.get('base_url')).toBeUndefined();
  });
});
