import type { Random } from '../../src/application/ports/random.js';

const SHORT_ID_LENGTH = 8;

export const fakeRandom = (): Random => {
  let draws = 0;
  const draw = (): number => {
    draws += 1;
    return draws;
  };
  return {
    hexToken: (bytes) =>
      draw()
        .toString(16)
        .padStart(bytes * 2, '0'),
    shortId: () => draw().toString(36).padStart(SHORT_ID_LENGTH, '0'),
  };
};
