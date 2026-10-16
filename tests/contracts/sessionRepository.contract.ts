import { expect, it } from 'vitest';
import type { Session, SessionRepository } from '../../src/application/ports/sessionRepository.js';

const PHONE: Session = {
  token: '7d1f4e2a9b3c8d5e6f708192a3b4c5d6e7f8091a2b3c4d5e6f708192a3b4c5d6',
  createdAt: '2026-10-13T10:00:00.000Z',
  expiresAt: '2027-04-11T10:00:00.000Z',
};

const LAPTOP: Session = {
  token: '0a9b8c7d6e5f4a3b2c1d0e9f8a7b6c5d4e3f2a1b0c9d8e7f6a5b4c3d2e1f0a9b',
  createdAt: '2026-04-01T08:00:00.000Z',
  expiresAt: '2026-09-28T08:00:00.000Z',
};

export function sessionRepositoryContract(create: () => SessionRepository): void {
  it('la session ouverte sur le téléphone à la connexion se retrouve à la requête suivante, avec son échéance', () => {
    // Given
    const sessions = create();

    // When
    sessions.create(PHONE);

    // Then
    expect(sessions.find(PHONE.token)).toEqual(PHONE);
    expect(sessions.find(LAPTOP.token)).toBeUndefined();
  });

  it('la session du téléphone prolongée par l’activité prend sa nouvelle échéance', () => {
    // Given
    const sessions = create();
    sessions.create(PHONE);

    // When
    sessions.extend(PHONE.token, '2027-04-13T18:30:00.000Z');

    // Then
    expect(sessions.find(PHONE.token)).toEqual({ ...PHONE, expiresAt: '2027-04-13T18:30:00.000Z' });
  });

  it('après la déconnexion du téléphone, sa session n’existe plus et celle de l’ordinateur reste', () => {
    // Given
    const sessions = create();
    sessions.create(PHONE);
    sessions.create(LAPTOP);

    // When
    sessions.delete(PHONE.token);

    // Then
    expect(sessions.find(PHONE.token)).toBeUndefined();
    expect(sessions.find(LAPTOP.token)).toEqual(LAPTOP);
  });

  it('le nettoyage efface la session de l’ordinateur arrivée à échéance, y compris à la seconde près, et garde celle du téléphone', () => {
    // Given
    const sessions = create();
    sessions.create(PHONE);
    sessions.create(LAPTOP);

    // When
    sessions.deleteExpired(LAPTOP.expiresAt);

    // Then
    expect(sessions.find(LAPTOP.token)).toBeUndefined();
    expect(sessions.find(PHONE.token)).toEqual(PHONE);
  });
}
