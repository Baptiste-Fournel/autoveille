import { newerDatabaseText } from '../../../domain/presentation/startup.js';

export class DatabaseNewerThanApplication extends Error {
  constructor(databaseVersion: number, latestKnownVersion: number) {
    super(newerDatabaseText(databaseVersion, latestKnownVersion));
    this.name = 'DatabaseNewerThanApplication';
  }
}
