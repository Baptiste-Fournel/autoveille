import { describe } from 'vitest';
import { scryptPasswordHasher } from '../../src/infrastructure/system/scryptPasswordHasher.js';
import { passwordHasherContract } from './passwordHasher.contract.js';

describe('PasswordHasher scrypt', () => {
  passwordHasherContract(() => scryptPasswordHasher);
});
