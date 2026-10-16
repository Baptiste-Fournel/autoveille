import type { FastifyHelmetOptions } from '@fastify/helmet';

const SELF = "'self'";

const NONE = "'none'";

const GOOGLE_FONTS_STYLESHEETS = 'https://fonts.googleapis.com';

const GOOGLE_FONTS_FILES = 'https://fonts.gstatic.com';

export const securityHeaders: FastifyHelmetOptions = {
  contentSecurityPolicy: {
    useDefaults: false,
    directives: {
      defaultSrc: [SELF],
      imgSrc: [SELF, 'https:', 'data:'],
      scriptSrc: [SELF],
      styleSrc: [SELF, GOOGLE_FONTS_STYLESHEETS],
      fontSrc: [SELF, GOOGLE_FONTS_FILES],
      connectSrc: [SELF],
      workerSrc: [SELF],
      manifestSrc: [SELF],
      frameAncestors: [NONE],
      baseUri: [SELF],
      formAction: [SELF],
    },
  },
};
