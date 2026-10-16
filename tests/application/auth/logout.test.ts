import { describe, expect, it } from 'vitest';
import { logout } from '../../../src/application/auth/logout.js';
import { openSession, validateSession } from '../../../src/application/auth/session.js';
import { authenticationFakes } from '../../support/authentication.js';

describe('déconnexion', () => {
  it('après déconnexion du téléphone, son ancien cookie ne donne plus accès et l’ordinateur reste connecté', () => {
    // Given
    const fakes = authenticationFakes();
    const phone = openSession(fakes);
    const laptop = openSession(fakes);

    // When
    logout(fakes, phone.token);

    // Then
    expect(validateSession(fakes, phone.token)).toBe(false);
    expect(validateSession(fakes, laptop.token)).toBe(true);
  });
});
