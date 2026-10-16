import { daysAfter } from '../../domain/time/daysAfter.js';
import type { Clock } from '../ports/clock.js';
import type { Random } from '../ports/random.js';
import type { Session, SessionRepository } from '../ports/sessionRepository.js';

export const SESSION_LIFETIME_DAYS = 180;

const SESSION_TOKEN_BYTES = 32;

export interface SessionDependencies {
  readonly sessions: SessionRepository;
  readonly clock: Clock;
}

export interface SessionOpeningDependencies extends SessionDependencies {
  readonly random: Random;
}

const expiryFrom = (instant: string): string => daysAfter(instant, SESSION_LIFETIME_DAYS);

export const openSession = ({ sessions, clock, random }: SessionOpeningDependencies): Session => {
  const createdAt = clock.now();
  const session: Session = { token: random.hexToken(SESSION_TOKEN_BYTES), createdAt, expiresAt: expiryFrom(createdAt) };
  sessions.create(session);
  return session;
};

export const validateSession = ({ sessions, clock }: SessionDependencies, token: string): boolean => {
  const session = sessions.find(token);
  const now = clock.now();
  if (session === undefined || session.expiresAt <= now) {
    return false;
  }
  sessions.extend(token, expiryFrom(now));
  return true;
};

export const deleteExpiredSessions = ({ sessions, clock }: SessionDependencies): void => {
  sessions.deleteExpired(clock.now());
};
