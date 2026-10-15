export interface Session {
  readonly token: string;
  readonly createdAt: string;
  readonly expiresAt: string;
}

export interface SessionRepository {
  create(session: Session): void;
  find(token: string): Session | undefined;
  extend(token: string, expiresAt: string): void;
  delete(token: string): void;
  deleteExpired(now: string): void;
}
