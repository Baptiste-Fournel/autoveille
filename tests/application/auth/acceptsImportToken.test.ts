import { describe, expect, it } from 'vitest';
import { acceptsImportToken } from '../../../src/application/auth/acceptsImportToken.js';
import { importToken } from '../../../src/application/auth/importToken.js';
import { authenticationFakes } from '../../support/authentication.js';

describe('jeton d’import', () => {
  it('la page d’un autre site qui envoie le bon jeton est acceptée, un jeton faux est refusé', () => {
    // Given
    const fakes = authenticationFakes();
    const token = importToken(fakes);

    // When
    const right = acceptsImportToken(fakes, token);
    const wrong = acceptsImportToken(fakes, token.replace(/1$/, '2'));

    // Then
    expect({ right, wrong }).toEqual({ right: true, wrong: false });
  });

  it('un import venu d’une autre page avant que l’application ait créé son jeton est refusé', () => {
    // Given
    const fakes = authenticationFakes();

    // When
    const accepted = acceptsImportToken(fakes, '3f9c2a7be41d08c65f1e2d3c4b5a69788796a5b4c3d2e1f0');

    // Then
    expect(accepted).toBe(false);
    expect(fakes.secrets.get('import_token')).toBeUndefined();
  });
});
