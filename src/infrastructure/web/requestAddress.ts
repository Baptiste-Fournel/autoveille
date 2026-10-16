import type { FastifyRequest } from 'fastify';

const API_PREFIX = '/api/';

const rawPathOf = (request: FastifyRequest): string => request.url.split('?')[0] ?? '';

export const addressOf = (request: FastifyRequest): string => {
  const route = request.routeOptions.url;
  return route?.startsWith(API_PREFIX) ? route : rawPathOf(request);
};

export const isApiAddress = (address: string): boolean => address.startsWith(API_PREFIX);
