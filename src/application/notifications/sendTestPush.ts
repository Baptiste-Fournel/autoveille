import {
  NO_SUBSCRIBED_DEVICE,
  partlySentText,
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
  const [firstFailure] = round.failures;
  if (firstFailure !== undefined) {
    return round.sent > 0
      ? { ok: true, detail: partlySentText(round.sent, round.failures.length, firstFailure.message) }
      : { ok: false, detail: sendingFailedText(firstFailure.message) };
  }
  return round.sent > 0 ? { ok: true, detail: testPushSentText(round.sent) } : { ok: false, detail: NO_SUBSCRIBED_DEVICE };
};
