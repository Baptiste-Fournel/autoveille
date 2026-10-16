import type { Logger } from '../../application/ports/logger.js';

export const consoleLogger: Logger = {
  info: (message) => console.log(message),
};
