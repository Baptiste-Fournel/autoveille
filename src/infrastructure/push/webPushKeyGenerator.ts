import webpush from 'web-push';
import type { PushKeyGenerator } from '../../application/ports/pushKeyGenerator.js';

export const webPushKeyGenerator: PushKeyGenerator = {
  generateKeyPair: () => {
    const { publicKey, privateKey } = webpush.generateVAPIDKeys();
    return { publicKey, privateKey };
  },
};
