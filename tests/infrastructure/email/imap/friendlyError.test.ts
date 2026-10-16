import { describe, expect, it } from 'vitest';
import { describeMailboxFailure } from '../../../../src/application/sources/describeMailboxFailure.js';
import { friendlyError } from '../../../../src/infrastructure/email/imap/friendlyError.js';
import { gmailRefusesPassword } from '../../../support/imapflowErrors.js';

describe('classement d’un échec IMAP', () => {
  it('un serveur Exchange qui refuse la session (« Authentication failed ») : refus d’authentification, et le message parle du mot de passe d’application', () => {
    // Given
    const error = new Error('Authentication failed');

    // When
    const unavailable = friendlyError(error);

    // Then
    expect(unavailable.problem).toBe('authenticationRefused');
    expect(describeMailboxFailure(unavailable)).toBe(
      'Connexion à la boîte mail refusée : vérifiez l’adresse et le mot de passe d’application (Gmail exige un mot de passe d’application, pas le mot de passe habituel).',
    );
  });

  it('un nom de serveur mal saisi (« getaddrinfo ENOTFOUND imap.gmial.com ») : serveur injoignable, avec le message de Node', () => {
    // Given
    const error = new Error('getaddrinfo ENOTFOUND imap.gmial.com');

    // When
    const unavailable = friendlyError(error);

    // Then
    expect(unavailable.problem).toBe('serverUnreachable');
    expect(describeMailboxFailure(unavailable)).toBe('Serveur mail injoignable (getaddrinfo ENOTFOUND imap.gmial.com).');
  });

  it('un serveur qui refuse la connexion sur son port (« connect ECONNREFUSED ») : serveur injoignable', () => {
    // Given
    const error = new Error('connect ECONNREFUSED 127.0.0.1:1');

    // When
    const unavailable = friendlyError(error);

    // Then
    expect(unavailable).toMatchObject({ problem: 'serverUnreachable', message: 'connect ECONNREFUSED 127.0.0.1:1' });
  });

  it('une connexion établie puis restée muette (« Socket timeout ») : serveur injoignable', () => {
    // Given
    const error = new Error('Socket timeout');

    // When
    const unavailable = friendlyError(error);

    // Then
    expect(unavailable.problem).toBe('serverUnreachable');
  });

  it('comportement hérité : Gmail refuse le mot de passe habituel, imapflow ne lève que « Command failed » : classé erreur de lecture, le message ne parle pas du mot de passe d’application', () => {
    // Given
    const error = gmailRefusesPassword();

    // When
    const unavailable = friendlyError(error);

    // Then
    expect(unavailable.problem).toBe('readFailed');
    expect(describeMailboxFailure(unavailable)).toBe('Erreur de lecture de la boîte mail : Command failed');
  });

  it('comportement hérité : un serveur qui ne répond pas dans le délai de connexion (« Failed to establish connection in required time ») est classé erreur de lecture, pas serveur injoignable', () => {
    // Given
    const error = Object.assign(new Error('Failed to establish connection in required time'), { code: 'CONNECT_TIMEOUT' });

    // When
    const unavailable = friendlyError(error);

    // Then
    expect(unavailable.problem).toBe('readFailed');
    expect(describeMailboxFailure(unavailable)).toBe(
      'Erreur de lecture de la boîte mail : Failed to establish connection in required time',
    );
  });
});
