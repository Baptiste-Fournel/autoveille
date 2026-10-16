import type { FastifySchema } from 'fastify';

export const setupSchema: FastifySchema = {
  body: {
    type: 'object',
    properties: {
      setupCode: { type: 'string' },
      password: { type: 'string' },
    },
  },
};

export const loginSchema: FastifySchema = {
  body: {
    type: 'object',
    properties: {
      password: { type: 'string' },
    },
  },
};
