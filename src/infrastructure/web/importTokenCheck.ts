import type { FastifyRequest } from 'fastify';
import { acceptsImportToken, type ImportTokenCheckDependencies } from '../../application/auth/acceptsImportToken.js';
import { sentByAnotherPage } from './authentication.js';
import { ImportTokenRefused } from './errors.js';

const NO_TOKEN = '';

const importTokenIn = (body: unknown): string =>
  typeof body === 'object' && body !== null && 'token' in body && typeof body.token === 'string' ? body.token : NO_TOKEN;

export const importTokenChecked =
  (dependencies: ImportTokenCheckDependencies) =>
  async (request: FastifyRequest): Promise<void> => {
    if (sentByAnotherPage(request) && !acceptsImportToken(dependencies, importTokenIn(request.body))) {
      throw new ImportTokenRefused();
    }
  };
