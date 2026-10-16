import type { FastifySchema } from 'fastify';
import type { RejectedKind, VehiclesQuery } from '../../../shared/api.js';

const REJECTED_KINDS: readonly RejectedKind[] = ['tous', 'suivies', 'loin', 'km', 'special', 'pro', 'marque'];

const MAX_VEHICLES_PER_PAGE = 1000;

const MAX_DAYS_WINDOW = 3650;

const FINITE = { not: { minimum: Number.MAX_VALUE } };

export interface VehiclesQuerystring extends Omit<VehiclesQuery, 'status'> {
  readonly status?: string;
}

export interface VehicleAddress {
  readonly id: number;
}

const vehicleAddress = {
  type: 'object',
  properties: {
    id: { type: 'integer' },
  },
  required: ['id'],
};

export const vehiclesQuerySchema: FastifySchema = {
  querystring: {
    type: 'object',
    properties: {
      status: { type: 'string' },
      kind: { type: 'string', enum: REJECTED_KINDS },
      days: { type: 'integer', minimum: 1, maximum: MAX_DAYS_WINDOW, ...FINITE },
      limit: { type: 'integer', minimum: 1, maximum: MAX_VEHICLES_PER_PAGE, ...FINITE },
      cursor: { type: 'string' },
    },
  },
};

export const vehicleAddressSchema: FastifySchema = {
  params: vehicleAddress,
};

export const vehicleUpdateSchema: FastifySchema = {
  params: vehicleAddress,
  body: {
    type: 'object',
    properties: {
      status: { type: 'string' },
      doNotContact: { type: 'boolean' },
      message: { type: ['string', 'null'] },
      keep: { type: 'boolean' },
      note: { type: ['string', 'null'] },
    },
  },
};
