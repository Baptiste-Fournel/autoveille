import { type TruncatedDigestNotice, truncatedDigestNotification } from './content.js';
import { publicAddress } from './publicAddress.js';
import { type NotificationDependencies, sendToChannels } from './sendToChannels.js';

export async function notifyTruncatedDigest(dependencies: NotificationDependencies, notice: TruncatedDigestNotice): Promise<void> {
  const baseUrl = publicAddress(dependencies.secrets, dependencies.address);
  await sendToChannels(dependencies, truncatedDigestNotification(notice, baseUrl));
}
