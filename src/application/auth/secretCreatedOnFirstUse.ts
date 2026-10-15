import type { Random } from '../ports/random.js';
import type { SecretKey, SecretStore } from '../ports/secretStore.js';

export interface SecretCreationDependencies {
  readonly secrets: SecretStore;
  readonly random: Random;
}

export const secretCreatedOnFirstUse = ({ secrets, random }: SecretCreationDependencies, key: SecretKey, bytes: number): string => {
  const existing = secrets.get(key);
  if (existing) {
    return existing;
  }
  const created = random.hexToken(bytes);
  secrets.set(key, created);
  return created;
};
