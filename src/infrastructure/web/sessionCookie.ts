import type { FastifyReply, FastifyRequest } from 'fastify';
import { SESSION_LIFETIME_DAYS } from '../../application/auth/session.js';

const SESSION_COOKIE = 'av_session';

const SECONDS_PER_DAY = 86_400;

const SESSION_COOKIE_MAX_AGE_SECONDS = SESSION_LIFETIME_DAYS * SECONDS_PER_DAY;

export const sessionTokenOf = (request: FastifyRequest): string | undefined => {
  const raw = request.cookies[SESSION_COOKIE];
  if (!raw) {
    return undefined;
  }
  const unsigned = request.unsignCookie(raw);
  return unsigned.valid && unsigned.value ? unsigned.value : undefined;
};

export const keepSessionCookie = (request: FastifyRequest, reply: FastifyReply, token: string): void => {
  reply.setCookie(SESSION_COOKIE, token, {
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
    secure: request.protocol === 'https',
    signed: true,
    maxAge: SESSION_COOKIE_MAX_AGE_SECONDS,
  });
};

export const clearSessionCookie = (reply: FastifyReply): void => {
  reply.clearCookie(SESSION_COOKIE, { path: '/' });
};
