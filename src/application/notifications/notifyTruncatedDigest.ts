import { type TruncatedDigestNotice, truncatedDigestNotification } from './content.js';
import { publicAddress } from './publicAddress.js';
import { type Delivery, type NotificationDependencies, sendToChannels } from './sendToChannels.js';

export async function notifyTruncatedDigest(dependencies: NotificationDependencies, notice: TruncatedDigestNotice): Promise<Delivery> {
  const baseUrl = publicAddress(dependencies.secrets, dependencies.address);
  return sendToChannels(dependencies, truncatedDigestNotification(notice, baseUrl));
}
