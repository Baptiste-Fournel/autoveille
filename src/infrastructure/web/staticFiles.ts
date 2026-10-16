import { basename, relative, sep } from 'node:path';
import type { FastifyStaticOptions } from '@fastify/static';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { addressOf, isApiAddress } from './requestAddress.js';

const PAGE = 'index.html';

const HASHED_ASSETS_DIRECTORY = 'assets';

const KEPT_A_DAY = /\.(png|svg|woff2?)$/;

const REVALIDATED = 'no-cache';

const CACHED_A_DAY = 'public, max-age=86400';

const CACHED_FOREVER = 'public, max-age=31536000, immutable';

const isHashedAsset = (directory: string, file: string): boolean => relative(directory, file).split(sep)[0] === HASHED_ASSETS_DIRECTORY;

const cacheControlOf = (directory: string, file: string): string => {
  if (basename(file) === PAGE) {
    return REVALIDATED;
  }
  if (isHashedAsset(directory, file)) {
    return CACHED_FOREVER;
  }
  return KEPT_A_DAY.test(file) ? CACHED_A_DAY : REVALIDATED;
};

export const staticFiles = (directory: string): FastifyStaticOptions => ({
  root: directory,
  prefix: '/',
  cacheControl: false,
  setHeaders: (reply, file) => {
    reply.header('cache-control', cacheControlOf(directory, file));
  },
});

export const revalidatedUnlessCached = async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
  if (!isApiAddress(addressOf(request)) && !reply.hasHeader('cache-control')) {
    reply.header('cache-control', REVALIDATED);
  }
};

export const pageOf = (reply: FastifyReply): FastifyReply => reply.sendFile(PAGE);
