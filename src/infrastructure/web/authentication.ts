import type { FastifyReply, FastifyRequest } from 'fastify';
import { type SessionDependencies, validateSession } from '../../application/auth/session.js';
import type { ErrorResponse } from '../../shared/api.js';
import { NOT_SIGNED_IN_TEXT } from './errors.js';
import { addressOf, isApiAddress } from './requestAddress.js';
import { keepSessionCookie, sessionTokenOf } from './sessionCookie.js';

const OPEN_ROUTES: readonly string[] = ['/api/me', '/api/login', '/api/setup', '/api/health'];

const TOKEN_CARRYING_IMPORTS: readonly string[] = ['/api/import', '/api/import/dates'];

export const sentByAnotherPage = (request: FastifyRequest): boolean => (request.headers['content-type'] ?? '').startsWith('text/plain');

const carriesImportToken = (request: FastifyRequest, address: string): boolean =>
  request.method === 'POST' && TOKEN_CARRYING_IMPORTS.includes(address) && sentByAnotherPage(request);

const requiresSession = (request: FastifyRequest): boolean => {
  const address = addressOf(request);
  return isApiAddress(address) && !OPEN_ROUTES.includes(address) && !carriesImportToken(request, address);
};

const NOT_SIGNED_IN: ErrorResponse = { error: NOT_SIGNED_IN_TEXT };

export const authentication =
  (sessions: SessionDependencies) =>
  async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    if (!requiresSession(request)) {
      return;
    }
    const token = sessionTokenOf(request);
    if (token === undefined || !validateSession(sessions, token)) {
      await reply.code(401).send(NOT_SIGNED_IN);
      return;
    }
    keepSessionCookie(request, reply, token);
  };
