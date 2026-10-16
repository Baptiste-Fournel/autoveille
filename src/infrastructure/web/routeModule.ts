import type { FastifyInstance } from 'fastify';
import type { WebDependencies } from './webDependencies.js';

export type RouteModule = (server: FastifyInstance, dependencies: WebDependencies) => void;
