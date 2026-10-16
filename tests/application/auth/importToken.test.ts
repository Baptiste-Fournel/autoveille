import { describe, expect, it } from 'vitest';
import { importToken } from '../../../src/application/auth/importToken.js';
import { authenticationFakes } from '../../support/authentication.js';

describe('jeton d’import', () => {
  it('le jeton d’import est créé à la première demande, puis reste le même d’une demande à l’autre', () => {
    // Given
    const fakes = authenticationFakes();

    // When
    const first = importToken(fakes);
    const second = importToken(fakes);

    // Then
    expect(first).toBe('01'.padStart(48, '0'));
    expect(second).toBe(first);
    expect(fakes.secrets.get('import_token')).toBe(first);
  });
});
