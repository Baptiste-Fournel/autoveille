import type { LegacyException } from './exceptions.js';

export const legacyExceptions: readonly LegacyException[] = [
  { path: 'public/app.js', rules: ['comment'] },
  { path: 'public/sw.js', rules: ['comment'] },
];
