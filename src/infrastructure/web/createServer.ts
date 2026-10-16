import fastifyCookie from '@fastify/cookie';
import fastifyEtag from '@fastify/etag';
import fastifyHelmet from '@fastify/helmet';
import fastifyStatic from '@fastify/static';
import Fastify, { type FastifyBodyParser, type FastifyInstance, LogController } from 'fastify';
import type { ErrorResponse } from '../../shared/api.js';
import { authentication } from './authentication.js';
import { INVALID_REQUEST_TEXT, rejectedAs, replyWithHttpError, UNKNOWN_API_ROUTE_TEXT } from './errors.js';
import { addressOf, isApiAddress } from './requestAddress.js';
import type { RouteModule } from './routeModule.js';
import { authRoutes } from './routes/auth.js';
import { healthRoutes } from './routes/health.js';
import { importRoutes } from './routes/import.js';
import { maintenanceRoutes } from './routes/maintenance.js';
import { notificationRoutes } from './routes/notifications.js';
import { overviewRoutes } from './routes/overview.js';
import { settingsRoutes } from './routes/settings.js';
import { sourceRoutes } from './routes/sources.js';
import { templateRoutes } from './routes/templates.js';
import { vehicleListRoutes, vehicleRoutes } from './routes/vehicles.js';
import { securityHeaders } from './securityHeaders.js';
import { pageOf, revalidatedUnlessCached, staticFiles } from './staticFiles.js';
import type { WebDependencies } from './webDependencies.js';

const LOCAL_PROXY_ONLY = 'loopback';

const ROUTES: readonly RouteModule[] = [
  authRoutes,
  healthRoutes,
  notificationRoutes,
  settingsRoutes,
  templateRoutes,
  sourceRoutes,
  maintenanceRoutes,
  vehicleRoutes,
];

const ROUTES_WITH_ETAG: readonly RouteModule[] = [overviewRoutes, vehicleListRoutes];

const ROUTES_READ_FROM_ANOTHER_PAGE: readonly RouteModule[] = [importRoutes];

const REFUSED = 'error';

const UNKNOWN_API_ROUTE: ErrorResponse = { error: UNKNOWN_API_ROUTE_TEXT };

const jsonSentAsText =
  (parseJson: FastifyBodyParser<string>): FastifyBodyParser<string> =>
  (request, body, done) => {
    parseJson(request, body, (error, value) => done(null, error === null ? value : {}));
  };

export const createServer = async (dependencies: WebDependencies): Promise<FastifyInstance> => {
  const server = Fastify({
    logger: dependencies.logging ? { level: 'info' } : false,
    logController: new LogController({ disableRequestLogging: true }),
    trustProxy: LOCAL_PROXY_ONLY,
    schemaErrorFormatter: rejectedAs(INVALID_REQUEST_TEXT),
  });
  await server.register(fastifyCookie, { secret: dependencies.cookieSecret });
  await server.register(fastifyHelmet, securityHeaders);
  await server.register(fastifyStatic, staticFiles(dependencies.staticDirectory));
  server.addHook('onRequest', authentication(dependencies.ports));
  server.addHook('onSend', revalidatedUnlessCached);
  server.setErrorHandler(replyWithHttpError);
  for (const routes of ROUTES) {
    routes(server, dependencies);
  }
  await server.register(async (readFromAnotherPage) => {
    readFromAnotherPage.addContentTypeParser(
      'text/plain',
      { parseAs: 'string' },
      jsonSentAsText(readFromAnotherPage.getDefaultJsonParser(REFUSED, REFUSED)),
    );
    for (const routes of ROUTES_READ_FROM_ANOTHER_PAGE) {
      routes(readFromAnotherPage, dependencies);
    }
  });
  await server.register(async (listed) => {
    await listed.register(fastifyEtag);
    for (const routes of ROUTES_WITH_ETAG) {
      routes(listed, dependencies);
    }
  });
  server.setNotFoundHandler(async (request, reply) =>
    isApiAddress(addressOf(request)) ? reply.code(404).send(UNKNOWN_API_ROUTE) : pageOf(reply),
  );
  return server;
};
