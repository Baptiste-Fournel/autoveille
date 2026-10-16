import { seedDemo } from '../application/ingest/seedDemo.js';
import { DEMO_COMMAND_DONE_TEXT } from '../domain/presentation/commands.js';
import { buildApplication, readConfig, systemEnvironment } from '../main.js';

const application = await buildApplication(systemEnvironment(readConfig(), false));
try {
  await seedDemo(application.ports);
  console.log(DEMO_COMMAND_DONE_TEXT);
} finally {
  await application.stop();
}
