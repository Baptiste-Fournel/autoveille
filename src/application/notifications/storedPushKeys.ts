import type { PushKeyPair } from '../ports/pushKeyGenerator.js';
import type { SecretStore } from '../ports/secretStore.js';

export const storedPushKeys = (secrets: Pick<SecretStore, 'get'>): PushKeyPair | undefined => {
  const publicKey = secrets.get('vapid_public');
  const privateKey = secrets.get('vapid_private');
  return publicKey && privateKey ? { publicKey, privateKey } : undefined;
};
