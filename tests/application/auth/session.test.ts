import { describe, expect, it } from 'vitest';
import { deleteExpiredSessions, openSession, validateSession } from '../../../src/application/auth/session.js';
import type { Session } from '../../../src/application/ports/sessionRepository.js';
import { authenticationFakes } from '../../support/authentication.js';

const LAPTOP_SESSION: Session = {
  token: '0a9b8c7d6e5f4a3b2c1d0e9f8a7b6c5d4e3f2a1b0c9d8e7f6a5b4c3d2e1f0a9b',
  createdAt: '2026-03-02T09:15:00.000Z',
  expiresAt: '2026-08-29T09:15:00.000Z',
};

describe('sessions', () => {
  it('le téléphone ouvert il y a cent jours est reconnu, et son échéance repart à cent quatre-vingts jours de la requête', () => {
    // Given
    const fakes = authenticationFakes();
    const phone = openSession(fakes);
    fakes.clock.set('2027-01-23T08:30:00.000Z');

    // When
    const accepted = validateSession(fakes, phone.token);

    // Then
    expect(accepted).toBe(true);
    expect(fakes.sessions.find(phone.token)).toEqual({ ...phone, expiresAt: '2027-07-22T08:30:00.000Z' });
  });

  it('un téléphone utilisé chaque trimestre garde sa session au-delà des cent quatre-vingts premiers jours', () => {
    // Given
    const fakes = authenticationFakes();
    const phone = openSession(fakes);
    fakes.clock.set('2027-01-23T08:30:00.000Z');
    validateSession(fakes, phone.token);
    fakes.clock.set('2027-06-22T08:30:00.000Z');

    // When
    const accepted = validateSession(fakes, phone.token);

    // Then
    expect(accepted).toBe(true);
  });

  it('une session restée cent quatre-vingts jours sans activité est refusée, à la seconde près, et n’est pas prolongée', () => {
    // Given
    const fakes = authenticationFakes();
    const phone = openSession(fakes);
    fakes.clock.set(phone.expiresAt);

    // When
    const accepted = validateSession(fakes, phone.token);

    // Then
    expect(accepted).toBe(false);
    expect(fakes.sessions.find(phone.token)).toEqual(phone);
  });

  it('un cookie dont la session est inconnue de la base, comme après la restauration d’une sauvegarde plus ancienne, est refusé', () => {
    // Given
    const fakes = authenticationFakes();
    openSession(fakes);

    // When
    const accepted = validateSession(fakes, '7d1f4e2a9b3c8d5e6f708192a3b4c5d6e7f8091a2b3c4d5e6f708192a3b4c5d6');

    // Then
    expect(accepted).toBe(false);
  });

  it('le nettoyage efface la session de l’ordinateur abandonné depuis le printemps et garde celle du téléphone', () => {
    // Given
    const fakes = authenticationFakes();
    fakes.sessions.create(LAPTOP_SESSION);
    const phone = openSession(fakes);

    // When
    deleteExpiredSessions(fakes);

    // Then
    expect(fakes.sessions.find(LAPTOP_SESSION.token)).toBeUndefined();
    expect(fakes.sessions.find(phone.token)).toEqual(phone);
  });
});
