import { describe, expect, it } from 'vitest';
import { type LoginDependencies, login } from '../../../src/application/auth/login.js';
import type { PasswordHasher } from '../../../src/application/ports/passwordHasher.js';
import {
  type AuthenticationFakes,
  authenticationFakes,
  LAPTOP_ADDRESS,
  OWNER_PASSWORD,
  OWNER_PASSWORD_HASH,
  PHONE_ADDRESS,
  PUBLIC_ORIGIN,
  refusalOf,
} from '../../support/authentication.js';

const MINUTE = 60_000;

const SCRYPT_DURATION_MS = 50;

const passwordChosen = (): LoginDependencies & AuthenticationFakes => ({
  ...authenticationFakes({ password_hash: OWNER_PASSWORD_HASH }),
  configuredBaseUrl: '',
});

const typos = [
  'garage-bordeaux-2025',
  'garage-bordeau-2026',
  'Garage-bordeaux-2026',
  'garage-bordeaux2026',
  'garage-bordeaux-202',
  'garage_bordeaux_2026',
  'garage-bordeaux-2027',
  'garage-bordaux-2026',
];

const tryPassword = (dependencies: LoginDependencies, password: string, clientAddress: string = PHONE_ADDRESS) =>
  refusalOf(() => login(dependencies, { password, clientAddress, origin: PUBLIC_ORIGIN }));

describe('essais de connexion', () => {
  it('après huit mots de passe faux, même le bon est refusé', () => {
    // Given
    const dependencies = passwordChosen();
    for (const typo of typos) {
      tryPassword(dependencies, typo);
    }

    // When
    const refusal = tryPassword(dependencies, OWNER_PASSWORD);

    // Then
    expect(refusal).toBe('tooManyAttempts');
  });

  it('après sept fautes de frappe, le bon mot de passe ouvre encore la session', () => {
    // Given
    const dependencies = passwordChosen();
    for (const typo of typos.slice(0, 7)) {
      tryPassword(dependencies, typo);
    }

    // When
    const refusal = tryPassword(dependencies, OWNER_PASSWORD);

    // Then
    expect(refusal).toBeUndefined();
  });

  it('comportement hérité : huit mots de passe faux étalés sur sept minutes bloquent la connexion jusqu’à dix minutes après le premier échec, pas dix minutes après le huitième', () => {
    // Given
    const dependencies = passwordChosen();
    for (const typo of typos) {
      tryPassword(dependencies, typo);
      dependencies.clock.advanceBy(MINUTE);
    }

    // When
    dependencies.clock.set('2026-10-15T08:39:00.000Z');
    const atNinthMinute = tryPassword(dependencies, OWNER_PASSWORD);
    dependencies.clock.set('2026-10-15T08:40:00.000Z');
    const atTenthMinute = tryPassword(dependencies, OWNER_PASSWORD);
    dependencies.clock.set('2026-10-15T08:40:00.001Z');
    const justAfter = tryPassword(dependencies, OWNER_PASSWORD);

    // Then
    expect({ atNinthMinute, atTenthMinute, justAfter }).toEqual({
      atNinthMinute: 'tooManyAttempts',
      atTenthMinute: 'tooManyAttempts',
      justAfter: undefined,
    });
  });

  it('une connexion réussie efface les fautes de frappe : cinq avant et cinq après n’empêchent pas d’entrer', () => {
    // Given
    const dependencies = passwordChosen();
    for (const typo of typos.slice(0, 5)) {
      tryPassword(dependencies, typo);
    }
    tryPassword(dependencies, OWNER_PASSWORD);
    for (const typo of typos.slice(3, 8)) {
      tryPassword(dependencies, typo);
    }

    // When
    const refusal = tryPassword(dependencies, OWNER_PASSWORD);

    // Then
    expect(refusal).toBeUndefined();
  });

  it('sept fautes de frappe un soir et une le lendemain ne bloquent pas la connexion', () => {
    // Given
    const dependencies = passwordChosen();
    dependencies.clock.set('2026-10-14T21:05:00.000Z');
    for (const typo of typos.slice(0, 7)) {
      tryPassword(dependencies, typo);
    }
    dependencies.clock.set('2026-10-15T07:45:00.000Z');
    tryPassword(dependencies, typos[7] ?? '');

    // When
    const refusal = tryPassword(dependencies, OWNER_PASSWORD);

    // Then
    expect(refusal).toBeUndefined();
  });

  it('une faute de frappe dont la vérification s’achève juste après la fin de la fenêtre compte dans une nouvelle fenêtre de dix minutes', () => {
    // Given
    const fakes = authenticationFakes({ password_hash: OWNER_PASSWORD_HASH });
    const slowHasher: PasswordHasher = {
      ...fakes.passwordHasher,
      verify: (password, hash) => {
        fakes.clock.advanceBy(SCRYPT_DURATION_MS);
        return fakes.passwordHasher.verify(password, hash);
      },
    };
    const dependencies: LoginDependencies & AuthenticationFakes = { ...fakes, passwordHasher: slowHasher, configuredBaseUrl: '' };
    for (const typo of typos.slice(0, 7)) {
      tryPassword(dependencies, typo);
    }
    dependencies.clock.set('2026-10-15T08:40:00.020Z');
    tryPassword(dependencies, typos[7] ?? '');
    dependencies.clock.set('2026-10-15T08:41:00.000Z');
    for (const typo of typos.slice(0, 7)) {
      tryPassword(dependencies, typo);
    }

    // When
    const refusal = tryPassword(dependencies, OWNER_PASSWORD);

    // Then
    expect(refusal).toBe('tooManyAttempts');
  });

  it('huit mots de passe faux tentés depuis une autre adresse ne bloquent pas la connexion du téléphone', () => {
    // Given
    const dependencies = passwordChosen();
    for (const typo of typos) {
      tryPassword(dependencies, typo, LAPTOP_ADDRESS);
    }

    // When
    const fromLaptop = tryPassword(dependencies, OWNER_PASSWORD, LAPTOP_ADDRESS);
    const fromPhone = tryPassword(dependencies, OWNER_PASSWORD, PHONE_ADDRESS);

    // Then
    expect({ fromLaptop, fromPhone }).toEqual({ fromLaptop: 'tooManyAttempts', fromPhone: undefined });
  });
});
