import { describe, expect, it } from 'vitest';
import { accessStatus } from '../../../src/application/auth/accessStatus.js';
import { openSession } from '../../../src/application/auth/session.js';
import { authenticationFakes, OWNER_PASSWORD_HASH, SETUP_CODE } from '../../support/authentication.js';

describe('état de l’accès à l’ouverture de l’application', () => {
  it('à la première visite, l’application demande de choisir le mot de passe', () => {
    // Given
    const dependencies = { ...authenticationFakes(), configuredSetupCode: '' };

    // When
    const status = accessStatus(dependencies, undefined);

    // Then
    expect(status).toEqual({ authenticated: false, needsSetup: true, setupCodeRequired: false });
  });

  it('avec un code de première connexion configuré, la mise en route demande le code', () => {
    // Given
    const dependencies = { ...authenticationFakes(), configuredSetupCode: SETUP_CODE };

    // When
    const status = accessStatus(dependencies, undefined);

    // Then
    expect(status).toEqual({ authenticated: false, needsSetup: true, setupCodeRequired: true });
  });

  it('un appareil sans session alors que le mot de passe est déjà choisi', () => {
    // Given
    const dependencies = { ...authenticationFakes({ password_hash: OWNER_PASSWORD_HASH }), configuredSetupCode: '' };

    // When
    const status = accessStatus(dependencies, undefined);

    // Then
    expect(status).toEqual({ authenticated: false, needsSetup: false, setupCodeRequired: false });
  });

  it('le téléphone connecté est reconnu en rouvrant l’application, et sa session est prolongée', () => {
    // Given
    const dependencies = { ...authenticationFakes({ password_hash: OWNER_PASSWORD_HASH }), configuredSetupCode: '' };
    const phone = openSession(dependencies);
    dependencies.clock.set('2026-11-02T19:00:00.000Z');

    // When
    const status = accessStatus(dependencies, phone.token);

    // Then
    expect(status).toEqual({ authenticated: true, needsSetup: false, setupCodeRequired: false });
    expect(dependencies.sessions.find(phone.token)?.expiresAt).toBe('2027-05-01T19:00:00.000Z');
  });
});
