import { randomBytes, randomInt } from 'node:crypto';
import type { Random } from '../../application/ports/random.js';

const SHORT_ID_BASE = 36;

const SHORT_ID_LENGTH = 8;

export const cryptoRandom: Random = {
  hexToken: (bytes) => randomBytes(bytes).toString('hex'),
  shortId: () =>
    randomInt(SHORT_ID_BASE ** SHORT_ID_LENGTH)
      .toString(SHORT_ID_BASE)
      .padStart(SHORT_ID_LENGTH, '0'),
};
