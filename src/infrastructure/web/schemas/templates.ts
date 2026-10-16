import type { FastifySchema } from 'fastify';
import { ALL_FAMILIES } from '../../../domain/catalog/families.js';

export const templatePreviewSchema: FastifySchema = {
  body: {
    type: 'object',
    properties: {
      family: { type: 'string', enum: ALL_FAMILIES },
      text: { type: 'string' },
      vehicleId: { type: 'integer' },
    },
  },
};
