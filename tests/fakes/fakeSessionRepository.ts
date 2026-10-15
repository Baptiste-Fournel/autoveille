import type { Session, SessionRepository } from '../../src/application/ports/sessionRepository.js';
import type { TransactionParticipant } from './fakeTransaction.js';

export type FakeSessionRepository = SessionRepository & TransactionParticipant;

export const fakeSessionRepository = (): FakeSessionRepository => {
  let sessions: readonly Session[] = [];
  return {
    create: (session) => {
      if (sessions.some((existing) => existing.token === session.token)) {
        throw new Error(`UNIQUE constraint failed: sessions.token`);
      }
      sessions = [...sessions, session];
    },
    find: (token) => sessions.find((session) => session.token === token),
    extend: (token, expiresAt) => {
      sessions = sessions.map((session) => (session.token === token ? { ...session, expiresAt } : session));
    },
    delete: (token) => {
      sessions = sessions.filter((session) => session.token !== token);
    },
    deleteExpired: (now) => {
      sessions = sessions.filter((session) => session.expiresAt > now);
    },
    snapshot: () => {
      const kept = sessions;
      return () => {
        sessions = kept;
      };
    },
  };
};
