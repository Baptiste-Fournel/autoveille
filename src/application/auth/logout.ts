import type { SessionRepository } from '../ports/sessionRepository.js';

export interface LogoutDependencies {
  readonly sessions: SessionRepository;
}

export const logout = ({ sessions }: LogoutDependencies, token: string): void => {
  sessions.delete(token);
};
