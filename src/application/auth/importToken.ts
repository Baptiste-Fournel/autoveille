import { type SecretCreationDependencies, secretCreatedOnFirstUse } from './secretCreatedOnFirstUse.js';

const IMPORT_TOKEN_BYTES = 24;

export const importToken = (dependencies: SecretCreationDependencies): string =>
  secretCreatedOnFirstUse(dependencies, 'import_token', IMPORT_TOKEN_BYTES);
