import { resolve } from 'node:path';
import { type ComposedApplication, composedApplication } from '../support/composedApplication.js';
import { E2E_WORLDS, type E2eWorld, READY_LINE } from './worlds.js';

const CLIENT_BUILD = resolve('dist/client');

const LOCAL_ONLY = '127.0.0.1';

const startedWorld = async (world: E2eWorld): Promise<ComposedApplication> => {
  const application = await composedApplication({ environment: world.environment, staticDirectory: CLIENT_BUILD });
  await application.start();
  await application.server.listen({ port: world.port, host: LOCAL_ONLY });
  return application;
};

const applications = await Promise.all(E2E_WORLDS.map(startedWorld));

const stopAll = async (): Promise<void> => {
  await Promise.all(applications.map((application) => application.stop()));
};

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, () => void stopAll());
}

console.log(`${READY_LINE} ${E2E_WORLDS.map((world) => world.port).join(', ')}`);
