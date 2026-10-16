import type { Session } from '../../../application/ports/sessionRepository.js';

export interface SessionRow {
  readonly token: string;
  readonly created_at: string;
  readonly expires_at: string;
}

export const sessionOf = (row: SessionRow): Session => ({
  token: row.token,
  createdAt: row.created_at,
  expiresAt: row.expires_at,
});

export const sessionRowOf = (session: Session): SessionRow => ({
  token: session.token,
  created_at: session.createdAt,
  expires_at: session.expiresAt,
});
