import { describe, expect, it } from 'vitest';
import { SqliteSecretStore } from '../../../src/infrastructure/persistence/sqlite/sqliteSecretStore.js';
import { migratedLegacyDatabase } from '../../support/migratedLegacyDatabase.js';
import { migratedSqliteDatabase } from '../../support/migratedSqliteDatabase.js';

const LEGACY_IMPORT_TOKEN = 'fe0566e54b852630c20fe4d99aff5c38d21098feca3bbd0f';

describe('secrets enregistrés dans SQLite', () => {
  it('le mot de passe choisi avant la mise à jour se relit au format hérité « sel:hachage », et le jeton d’import des pages de recherche est toujours reconnu', () => {
    // Given
    const secrets = new SqliteSecretStore(migratedLegacyDatabase());

    // When
    const passwordHash = secrets.get('password_hash');
    const accepted = secrets.matches('import_token', LEGACY_IMPORT_TOKEN);

    // Then
    expect(passwordHash).toMatch(/^[0-9a-f]{32}:[0-9a-f]{128}$/);
    expect(accepted).toBe(true);
  });

  it('un jeton d’import recopié avec une lettre accentuée, de la même longueur que le vrai, est refusé sans faire échouer l’import', () => {
    // Given
    const secrets = new SqliteSecretStore(migratedSqliteDatabase());
    secrets.set('import_token', LEGACY_IMPORT_TOKEN);
    const accented = `é${LEGACY_IMPORT_TOKEN.slice(1)}`;

    // When
    const accepted = (): boolean => secrets.matches('import_token', accented);

    // Then
    expect(accepted).not.toThrow();
    expect(accepted()).toBe(false);
  });
});
