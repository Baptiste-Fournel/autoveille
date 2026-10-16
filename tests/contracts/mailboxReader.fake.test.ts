import { describe } from 'vitest';
import { fakeMailboxReader } from '../fakes/fakeMailboxReader.js';
import { mailboxReaderContract } from './mailboxReader.contract.js';

describe('MailboxReader en mémoire', () => {
  mailboxReaderContract(({ uidValidity, emails }) => fakeMailboxReader({ uidValidity, emails }));
});
