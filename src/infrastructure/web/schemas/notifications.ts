import type { FastifySchema } from 'fastify';

export const subscribeSchema: FastifySchema = {
  body: {
    type: 'object',
    required: ['subscription'],
    properties: {
      subscription: {
        type: 'object',
        required: ['endpoint'],
        properties: {
          endpoint: { type: 'string', minLength: 1 },
          expirationTime: { type: ['number', 'null'] },
          keys: {
            type: 'object',
            required: ['p256dh', 'auth'],
            properties: {
              p256dh: { type: 'string' },
              auth: { type: 'string' },
            },
          },
        },
      },
    },
  },
};

export const unsubscribeSchema: FastifySchema = {
  body: {
    type: 'object',
    required: ['endpoint'],
    properties: {
      endpoint: { type: 'string' },
    },
  },
};

export const telegramTestSchema: FastifySchema = {
  body: {
    type: 'object',
    properties: {
      token: { type: 'string' },
      chatId: { type: 'string' },
    },
  },
};
