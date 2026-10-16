import { describe, expect, it } from 'vitest';
import { defaultSettings } from '../../../src/domain/settings/defaults.js';
import { SqliteSettingsRepository } from '../../../src/infrastructure/persistence/sqlite/sqliteSettingsRepository.js';
import { garageDuLac } from '../../support/dealer.js';
import { loadFixture } from '../../support/fixtures.js';
import { migratedLegacyDatabase } from '../../support/migratedLegacyDatabase.js';
import { migratedSqliteDatabase } from '../../support/migratedSqliteDatabase.js';

const savedAsLegacyApplication = (fixture: string): string => JSON.stringify(JSON.parse(loadFixture(fixture)));

describe('réglages enregistrés dans SQLite', () => {
  it('les réglages de la base de production migrée se relisent tels que l’application les avait enregistrés, confirmations d’alerte comprises', () => {
    // Given
    const settings = new SqliteSettingsRepository(migratedLegacyDatabase());

    // When
    const loaded = settings.load();

    // Then
    expect(loaded).toEqual(JSON.parse(loadFixture('db/settings-legacy.json')));
  });

  it('les réglages enregistrés par la première version (14/10/2026), avec le téléphone d’exemple « 06 00 00 00 00 » et sans alertes, se relisent complétés : téléphone vide, aucune alerte, marques « autres » connues depuis', () => {
    // Given
    const database = migratedSqliteDatabase();
    database.prepare("INSERT INTO settings (key, json) VALUES ('main', ?)").run(savedAsLegacyApplication('db/settings-v1.json'));

    // When
    const loaded = new SqliteSettingsRepository(database).load();

    // Then
    expect(loaded).toEqual({
      ...defaultSettings(),
      dealer: { ...garageDuLac, phone: '' },
      zone: { city: 'Mérignac', postalCode: '33700', lat: 44.8386, lon: -0.6436, radiusKm: 150 },
    });
  });

  it('des réglages rendus illisibles par une retouche à la main dans la base : l’application repart des réglages par défaut au lieu de s’arrêter', () => {
    // Given
    const database = migratedSqliteDatabase();
    const truncated = savedAsLegacyApplication('db/settings-legacy.json').slice(0, 2000);
    database.prepare("INSERT INTO settings (key, json) VALUES ('main', ?)").run(truncated);

    // When
    const loaded = new SqliteSettingsRepository(database).load();

    // Then
    expect(loaded).toEqual(defaultSettings());
  });
});
