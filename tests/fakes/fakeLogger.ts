import type { Logger } from '../../src/application/ports/logger.js';

export interface FakeLogger extends Logger {
  readonly messages: () => readonly string[];
}

export const fakeLogger = (): FakeLogger => {
  let messages: readonly string[] = [];
  return {
    info: (message) => {
      messages = [...messages, message];
    },
    messages: () => messages,
  };
};
