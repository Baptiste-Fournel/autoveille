import type { FastifySchema } from 'fastify';

const listOfObjects = { type: 'array', items: { type: 'object' } } as const;

export const importSchema: FastifySchema = {
  body: {
    type: 'object',
    properties: {
      listings: listOfObjects,
      notify: { type: 'boolean' },
    },
  },
};

export const publishedDatesSchema: FastifySchema = {
  body: {
    type: 'object',
    properties: {
      items: listOfObjects,
    },
  },
};
