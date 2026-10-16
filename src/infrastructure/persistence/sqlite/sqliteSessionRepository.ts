import type Database from 'better-sqlite3';
import type { Session, SessionRepository } from '../../../application/ports/sessionRepository.js';
import { type SessionRow, sessionOf, sessionRowOf } from './sessionMapper.js';

export class SqliteSessionRepository implements SessionRepository {
  private readonly insertSession: Database.Statement<[SessionRow]>;
  private readonly selectSession: Database.Statement<[string], SessionRow>;
  private readonly updateExpiry: Database.Statement<[Pick<SessionRow, 'token' | 'expires_at'>]>;
  private readonly deleteSession: Database.Statement<[string]>;
  private readonly deleteExpiredSessions: Database.Statement<[string]>;

  constructor(database: Database.Database) {
    this.insertSession = database.prepare<[SessionRow]>(
      'INSERT INTO sessions (token, created_at, expires_at) VALUES (@token, @created_at, @expires_at)',
    );
    this.selectSession = database.prepare<[string], SessionRow>('SELECT token, created_at, expires_at FROM sessions WHERE token = ?');
    this.updateExpiry = database.prepare<[Pick<SessionRow, 'token' | 'expires_at'>]>(
      'UPDATE sessions SET expires_at = @expires_at WHERE token = @token',
    );
    this.deleteSession = database.prepare<[string]>('DELETE FROM sessions WHERE token = ?');
    this.deleteExpiredSessions = database.prepare<[string]>('DELETE FROM sessions WHERE expires_at <= ?');
  }

  create(session: Session): void {
    this.insertSession.run(sessionRowOf(session));
  }

  find(token: string): Session | undefined {
    const row = this.selectSession.get(token);
    return row === undefined ? undefined : sessionOf(row);
  }

  extend(token: string, expiresAt: string): void {
    this.updateExpiry.run({ token, expires_at: expiresAt });
  }

  delete(token: string): void {
    this.deleteSession.run(token);
  }

  deleteExpired(now: string): void {
    this.deleteExpiredSessions.run(now);
  }
}
