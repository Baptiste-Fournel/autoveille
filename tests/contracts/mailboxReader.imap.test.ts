import { describe } from 'vitest';
import { imapMailboxReader } from '../../src/infrastructure/email/imap/imapMailboxReader.js';
import { simulatedImapClient } from '../support/simulatedImapClient.js';
import { mailboxReaderContract } from './mailboxReader.contract.js';

describe('MailboxReader en IMAP, sur un serveur simulé', () => {
  mailboxReaderContract(({ uidValidity, emails }) =>
    imapMailboxReader(simulatedImapClient({ uidValidity: BigInt(uidValidity), messages: emails }).createClient),
  );
});
