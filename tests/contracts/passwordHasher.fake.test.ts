import { describe } from 'vitest';
import { fakePasswordHasher } from '../fakes/fakePasswordHasher.js';
import { passwordHasherContract } from './passwordHasher.contract.js';

describe('PasswordHasher en mémoire', () => {
  passwordHasherContract(() => fakePasswordHasher());
});
