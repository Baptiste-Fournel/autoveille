import { MAILBOX_AUTHENTICATION_REFUSED, mailboxReadErrorText, mailboxUnreachableText } from '../../domain/presentation/mailbox.js';
import { MailboxUnavailable } from '../ports/mailboxUnavailable.js';
import { errorMessage } from './errorMessage.js';

export const describeMailboxFailure = (error: unknown): string => {
  if (!(error instanceof MailboxUnavailable)) {
    return mailboxReadErrorText(errorMessage(error));
  }
  switch (error.problem) {
    case 'authenticationRefused':
      return MAILBOX_AUTHENTICATION_REFUSED;
    case 'serverUnreachable':
      return mailboxUnreachableText(error.message);
    case 'readFailed':
      return mailboxReadErrorText(error.message);
  }
};
