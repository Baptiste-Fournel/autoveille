import { expect, it } from 'vitest';
import type { SecretStore } from '../../src/application/ports/secretStore.js';

const IMPORT_TOKEN = '3f9c2a7be41d08c65f1e2d3c4b5a69788796a5b4c3d2e1f0';

export function secretStoreContract(create: () => SecretStore): void {
  it('avant la première connexion, aucun mot de passe n’est enregistré', () => {
    // Given
    const store = create();

    // When
    const hash = store.get('password_hash');

    // Then
    expect(hash).toBeUndefined();
  });

  it('le mot de passe choisi à la mise en route se relit sous sa forme hachée, sans toucher aux autres secrets', () => {
    // Given
    const store = create();
    store.set('cookie_secret', 'c0ffee1234567890c0ffee1234567890c0ffee1234567890c0ffee1234567890');

    // When
    store.set('password_hash', '9a1b2c3d4e5f60718293a4b5c6d7e8f9:5e88489');

    // Then
    expect(store.get('password_hash')).toBe('9a1b2c3d4e5f60718293a4b5c6d7e8f9:5e88489');
    expect(store.get('cookie_secret')).toBe('c0ffee1234567890c0ffee1234567890c0ffee1234567890c0ffee1234567890');
  });

  it('le jeton d’import envoyé par une page de recherche ouverte à la main est reconnu', () => {
    // Given
    const store = create();
    store.set('import_token', IMPORT_TOKEN);

    // When
    const accepted = store.matches('import_token', IMPORT_TOKEN);

    // Then
    expect(accepted).toBe(true);
  });

  it('un jeton d’import faux, tronqué, ou envoyé avant que l’application en ait créé un est refusé', () => {
    // Given
    const store = create();
    const beforeCreation = store.matches('import_token', IMPORT_TOKEN);
    store.set('import_token', IMPORT_TOKEN);

    // When
    const wrong = store.matches('import_token', IMPORT_TOKEN.replace('3f9c', '3f9d'));
    const truncated = store.matches('import_token', IMPORT_TOKEN.slice(0, 40));
    const empty = store.matches('import_token', '');

    // Then
    expect({ beforeCreation, wrong, truncated, empty }).toEqual({ beforeCreation: false, wrong: false, truncated: false, empty: false });
  });
}
