import { describe } from 'vitest';
import { fakeMailboxStateRepository } from '../fakes/fakeMailboxStateRepository.js';
import { mailboxStateRepositoryContract } from './mailboxStateRepository.contract.js';

describe('MailboxStateRepository en mémoire', () => {
  mailboxStateRepositoryContract(fakeMailboxStateRepository);
});
