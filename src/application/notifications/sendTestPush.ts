import {
  NO_SUBSCRIBED_DEVICE,
  sendingFailedText,
  TEST_PUSH_BODY,
  TEST_PUSH_TITLE,
  testPushSentText,
} from '../../domain/presentation/notificationTests.js';
import type { SecretStore } from '../ports/secretStore.js';
import { type PublicAddressSettings, publicAddress } from './publicAddress.js';
import { type PushDependencies, pushToSubscribers } from './pushToSubscribers.js';
import type { TestSendResult } from './testSendResult.js';

export interface TestPushDependencies extends PushDependencies {
  readonly secrets: SecretStore;
  readonly address: PublicAddressSettings;
}

export const sendTestPush = async (dependencies: TestPushDependencies): Promise<TestSendResult> => {
  const round = await pushToSubscribers(dependencies, {
    title: TEST_PUSH_TITLE,
    body: TEST_PUSH_BODY,
    url: `${publicAddress(dependencies.secrets, dependencies.address)}/`,
  });
  if (round.kind === 'failed') {
    return { ok: false, detail: sendingFailedText(round.error.message) };
  }
  return round.sent > 0 ? { ok: true, detail: testPushSentText(round.sent) } : { ok: false, detail: NO_SUBSCRIBED_DEVICE };
};
