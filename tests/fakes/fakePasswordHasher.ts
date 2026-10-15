import type { PasswordHasher } from '../../src/application/ports/passwordHasher.js';

const hashOf = (password: string): string => `fake-scrypt:${password}`;

export const fakePasswordHasher = (): PasswordHasher => ({
  hash: hashOf,
  verify: (password, hash) => hash === hashOf(password),
});
