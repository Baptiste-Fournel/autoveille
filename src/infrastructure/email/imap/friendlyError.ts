import { type MailboxProblem, MailboxUnavailable } from '../../../application/ports/mailboxUnavailable.js';
import { errorMessage } from '../../../application/sources/errorMessage.js';

const AUTHENTICATION_REFUSED = /auth|credentials|invalid|login|password/i;

const SERVER_UNREACHABLE = /ENOTFOUND|EAI_AGAIN|ECONN|timeout/i;

const problemOf = (message: string): MailboxProblem => {
  if (AUTHENTICATION_REFUSED.test(message)) {
    return 'authenticationRefused';
  }
  return SERVER_UNREACHABLE.test(message) ? 'serverUnreachable' : 'readFailed';
};

export const friendlyError = (error: unknown): MailboxUnavailable => {
  const message = errorMessage(error);
  return new MailboxUnavailable(problemOf(message), message);
};
