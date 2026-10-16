import type Database from 'better-sqlite3';
import type { SettingsRepository } from '../../../application/ports/settingsRepository.js';
import type { Settings } from '../../../domain/settings/types.js';
import { settingsJsonOf, settingsOf } from './settingsMapper.js';

interface SettingsRow {
  readonly json: string;
}

export class SqliteSettingsRepository implements SettingsRepository {
  private readonly selectSettings: Database.Statement<[], SettingsRow>;
  private readonly upsertSettings: Database.Statement<[string]>;

  constructor(database: Database.Database) {
    this.selectSettings = database.prepare<[], SettingsRow>("SELECT json FROM settings WHERE key = 'main'");
    this.upsertSettings = database.prepare<[string]>(
      "INSERT INTO settings (key, json) VALUES ('main', ?) ON CONFLICT (key) DO UPDATE SET json = excluded.json",
    );
  }

  load(): Settings {
    return settingsOf(this.selectSettings.get()?.json);
  }

  save(settings: Settings): void {
    this.upsertSettings.run(settingsJsonOf(settings));
  }
}
