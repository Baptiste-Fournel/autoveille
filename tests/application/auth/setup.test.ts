import { describe, expect, it } from 'vitest';
import { type SetupDependencies, setup } from '../../../src/application/auth/setup.js';
import { publicAddress } from '../../../src/application/notifications/publicAddress.js';
import { FAKE_NOW } from '../../fakes/fakeClock.js';
import {
  type AuthenticationFakes,
  authenticationFakes,
  LOCAL_ORIGIN,
  OWNER_PASSWORD,
  OWNER_PASSWORD_HASH,
  PHONE_ADDRESS,
  PUBLIC_ORIGIN,
  refusalOf,
  SETUP_CODE,
  THIS_MACHINE,
} from '../../support/authentication.js';

const withoutSetupCode = (): SetupDependencies & AuthenticationFakes => ({
  ...authenticationFakes(),
  configuredSetupCode: '',
  configuredBaseUrl: '',
});

const withSetupCode = (): SetupDependencies & AuthenticationFakes => ({
  ...authenticationFakes(),
  configuredSetupCode: SETUP_CODE,
  configuredBaseUrl: '',
});

const ADDRESS_SETTINGS = { configuredBaseUrl: '', port: 3000 };

describe('première connexion', () => {
  it('sans code configuré, le concessionnaire choisit son mot de passe depuis la machine qui héberge l’application', () => {
    // Given
    const dependencies = withoutSetupCode();

    // When
    const session = setup(dependencies, { setupCode: '', password: OWNER_PASSWORD, clientAddress: THIS_MACHINE, origin: LOCAL_ORIGIN });

    // Then
    expect(dependencies.secrets.get('password_hash')).toBe(OWNER_PASSWORD_HASH);
    expect(session).toEqual({ token: '01'.padStart(64, '0'), createdAt: FAKE_NOW, expiresAt: '2027-04-13T08:30:00.000Z' });
    expect(dependencies.sessions.find(session.token)).toEqual(session);
  });

  it('sur une machine qui écoute en IPv6, la première connexion locale arrive en ::1 ou en ::ffff:127.0.0.1 et reste acceptée', () => {
    // Given
    const loopback = withoutSetupCode();
    const mappedIpv4 = withoutSetupCode();

    // When
    setup(loopback, { setupCode: '', password: OWNER_PASSWORD, clientAddress: '::1', origin: LOCAL_ORIGIN });
    setup(mappedIpv4, { setupCode: '', password: OWNER_PASSWORD, clientAddress: '::ffff:127.0.0.1', origin: LOCAL_ORIGIN });

    // Then
    expect(loopback.secrets.get('password_hash')).toBe(OWNER_PASSWORD_HASH);
    expect(mappedIpv4.secrets.get('password_hash')).toBe(OWNER_PASSWORD_HASH);
  });

  it('comportement hérité : sans code configuré, la première connexion depuis le téléphone est refusée comme un code faux', () => {
    // Given
    const dependencies = withoutSetupCode();

    // When
    const refusal = refusalOf(() =>
      setup(dependencies, { setupCode: '', password: OWNER_PASSWORD, clientAddress: PHONE_ADDRESS, origin: PUBLIC_ORIGIN }),
    );

    // Then
    expect(refusal).toBe('wrongSetupCode');
    expect(dependencies.secrets.get('password_hash')).toBeUndefined();
    expect(dependencies.secrets.get('base_url')).toBeUndefined();
  });

  it('avec un code de première connexion configuré, un code faux est refusé', () => {
    // Given
    const dependencies = withSetupCode();

    // When
    const refusal = refusalOf(() =>
      setup(dependencies, { setupCode: '4821-7731', password: OWNER_PASSWORD, clientAddress: PHONE_ADDRESS, origin: PUBLIC_ORIGIN }),
    );

    // Then
    expect(refusal).toBe('wrongSetupCode');
    expect(dependencies.secrets.get('password_hash')).toBeUndefined();
  });

  it('le code de première connexion recopié avec des espaces autour ouvre la session depuis le téléphone', () => {
    // Given
    const dependencies = withSetupCode();

    // When
    const session = setup(dependencies, {
      setupCode: ' 4821-7730 ',
      password: OWNER_PASSWORD,
      clientAddress: PHONE_ADDRESS,
      origin: PUBLIC_ORIGIN,
    });

    // Then
    expect(dependencies.secrets.get('password_hash')).toBe(OWNER_PASSWORD_HASH);
    expect(dependencies.sessions.find(session.token)).toEqual(session);
  });

  it('avec un code configuré, la machine qui héberge l’application doit aussi le saisir', () => {
    // Given
    const dependencies = withSetupCode();

    // When
    const refusal = refusalOf(() =>
      setup(dependencies, { setupCode: '', password: OWNER_PASSWORD, clientAddress: THIS_MACHINE, origin: LOCAL_ORIGIN }),
    );

    // Then
    expect(refusal).toBe('wrongSetupCode');
    expect(dependencies.secrets.get('password_hash')).toBeUndefined();
  });

  it('un mot de passe de moins de huit caractères est refusé', () => {
    // Given
    const dependencies = withSetupCode();

    // When
    const refusal = refusalOf(() =>
      setup(dependencies, { setupCode: SETUP_CODE, password: 'porsche', clientAddress: PHONE_ADDRESS, origin: PUBLIC_ORIGIN }),
    );

    // Then
    expect(refusal).toBe('passwordTooShort');
    expect(dependencies.secrets.get('password_hash')).toBeUndefined();
    expect(dependencies.secrets.get('base_url')).toBeUndefined();
  });

  it('des mots de passe trop courts ne comptent pas comme des essais : après huit refus, la première connexion reste possible', () => {
    // Given
    const dependencies = withSetupCode();
    for (const shortPassword of ['porsche', '911', 'gt3rs', 'carrera', 'alpine', 'a110', 'mustang', 'bronco']) {
      refusalOf(() =>
        setup(dependencies, { setupCode: SETUP_CODE, password: shortPassword, clientAddress: PHONE_ADDRESS, origin: PUBLIC_ORIGIN }),
      );
    }

    // When
    const session = setup(dependencies, {
      setupCode: SETUP_CODE,
      password: OWNER_PASSWORD,
      clientAddress: PHONE_ADDRESS,
      origin: PUBLIC_ORIGIN,
    });

    // Then
    expect(dependencies.sessions.find(session.token)).toEqual(session);
  });

  it('une seconde première connexion est refusée une fois le mot de passe choisi', () => {
    // Given
    const dependencies: SetupDependencies = {
      ...authenticationFakes({ password_hash: OWNER_PASSWORD_HASH }),
      configuredSetupCode: '',
      configuredBaseUrl: '',
    };

    // When
    const refusal = refusalOf(() =>
      setup(dependencies, { setupCode: '', password: 'un-autre-mot-de-passe', clientAddress: THIS_MACHINE, origin: LOCAL_ORIGIN }),
    );

    // Then
    expect(refusal).toBe('passwordAlreadyChosen');
    expect(dependencies.secrets.get('password_hash')).toBe(OWNER_PASSWORD_HASH);
  });

  it('après huit codes faux depuis le téléphone, même le bon code est refusé', () => {
    // Given
    const dependencies = withSetupCode();
    for (const attempt of [1, 2, 3, 4, 5, 6, 7, 8]) {
      refusalOf(() =>
        setup(dependencies, {
          setupCode: `4821-773${attempt + 1}`,
          password: OWNER_PASSWORD,
          clientAddress: PHONE_ADDRESS,
          origin: PUBLIC_ORIGIN,
        }),
      );
      dependencies.clock.advanceBy(1000);
    }

    // When
    const refusal = refusalOf(() =>
      setup(dependencies, { setupCode: SETUP_CODE, password: OWNER_PASSWORD, clientAddress: PHONE_ADDRESS, origin: PUBLIC_ORIGIN }),
    );

    // Then
    expect(refusal).toBe('tooManyAttempts');
    expect(dependencies.secrets.get('password_hash')).toBeUndefined();
  });

  it('sans BASE_URL, l’adresse de la première connexion devient celle des liens des notifications', () => {
    // Given
    const dependencies = withSetupCode();

    // When
    setup(dependencies, { setupCode: SETUP_CODE, password: OWNER_PASSWORD, clientAddress: PHONE_ADDRESS, origin: PUBLIC_ORIGIN });

    // Then
    expect(dependencies.secrets.get('base_url')).toBe(PUBLIC_ORIGIN);
    expect(publicAddress(dependencies.secrets, ADDRESS_SETTINGS)).toBe(PUBLIC_ORIGIN);
  });

  it('avec BASE_URL configurée, la première connexion ne retient pas son adresse', () => {
    // Given
    const dependencies: SetupDependencies = { ...withSetupCode(), configuredBaseUrl: PUBLIC_ORIGIN };

    // When
    setup(dependencies, { setupCode: SETUP_CODE, password: OWNER_PASSWORD, clientAddress: THIS_MACHINE, origin: LOCAL_ORIGIN });

    // Then
    expect(dependencies.secrets.get('base_url')).toBeUndefined();
    expect(publicAddress(dependencies.secrets, { ...ADDRESS_SETTINGS, configuredBaseUrl: PUBLIC_ORIGIN })).toBe(PUBLIC_ORIGIN);
  });
});
