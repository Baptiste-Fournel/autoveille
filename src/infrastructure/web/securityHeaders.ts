import type { FastifyHelmetOptions } from '@fastify/helmet';

const SELF = "'self'";

const NONE = "'none'";

export const securityHeaders: FastifyHelmetOptions = {
  contentSecurityPolicy: {
    useDefaults: false,
    directives: {
      defaultSrc: [SELF],
      imgSrc: [SELF, 'https:', 'data:'],
      scriptSrc: [SELF],
      styleSrc: [SELF],
      fontSrc: [SELF],
      connectSrc: [SELF],
      workerSrc: [SELF],
      manifestSrc: [SELF],
      frameAncestors: [NONE],
      baseUri: [SELF],
      formAction: [SELF],
    },
  },
};
