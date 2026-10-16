import { expect, it } from 'vitest';
import type { PasswordHasher } from '../../src/application/ports/passwordHasher.js';

const CHOSEN_PASSWORD = 'Graves-Mérignac 2026';

export function passwordHasherContract(create: () => PasswordHasher): void {
  it('le mot de passe choisi à la mise en route est reconnu à la connexion suivante', () => {
    // Given
    const hasher = create();
    const stored = hasher.hash(CHOSEN_PASSWORD);

    // When
    const accepted = hasher.verify(CHOSEN_PASSWORD, stored);

    // Then
    expect(accepted).toBe(true);
  });

  it('le même mot de passe tapé sans sa majuscule est refusé', () => {
    // Given
    const hasher = create();
    const stored = hasher.hash(CHOSEN_PASSWORD);

    // When
    const accepted = hasher.verify('graves-Mérignac 2026', stored);

    // Then
    expect(accepted).toBe(false);
  });
}
