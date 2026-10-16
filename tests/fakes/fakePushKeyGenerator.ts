import type { PushKeyGenerator, PushKeyPair } from '../../src/application/ports/pushKeyGenerator.js';

export const FAKE_PUSH_KEYS: PushKeyPair = {
  publicKey: 'BFakeVapidPublicKeyForTestsOnly0000000000000000000000000000000000000000000000000000000',
  privateKey: 'fake-vapid-private-key-for-tests-only',
};

export const fakePushKeyGenerator = (): PushKeyGenerator => ({
  generateKeyPair: () => FAKE_PUSH_KEYS,
});
