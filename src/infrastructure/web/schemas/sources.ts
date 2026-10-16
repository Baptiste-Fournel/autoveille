import type { FastifySchema } from 'fastify';

const TEXT = { type: 'string' } as const;

export const mailboxTestSchema: FastifySchema = {
  body: {
    type: 'object',
    properties: {
      host: TEXT,
      port: { type: 'number' },
      user: TEXT,
      pass: TEXT,
      mailbox: TEXT,
    },
  },
};

export const httpSiteTestSchema: FastifySchema = {
  body: {
    type: 'object',
    properties: {
      url: TEXT,
    },
  },
};
