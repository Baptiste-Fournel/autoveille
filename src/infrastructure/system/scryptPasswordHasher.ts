import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import type { PasswordHasher } from '../../application/ports/passwordHasher.js';

const SALT_BYTES = 16;

const KEY_LENGTH = 64;

const derivedKey = (password: string, salt: string): Buffer => scryptSync(password, salt, KEY_LENGTH);

export const scryptPasswordHasher: PasswordHasher = {
  hash: (password) => {
    const salt = randomBytes(SALT_BYTES).toString('hex');
    return `${salt}:${derivedKey(password, salt).toString('hex')}`;
  },
  verify: (password, stored) => {
    const [salt, hash] = stored.split(':');
    if (!salt || !hash) {
      return false;
    }
    const candidate = derivedKey(password, salt);
    const expected = Buffer.from(hash, 'hex');
    return candidate.length === expected.length && timingSafeEqual(candidate, expected);
  },
};
