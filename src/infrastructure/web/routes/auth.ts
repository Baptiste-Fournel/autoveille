import type { FastifyRequest } from 'fastify';
import { accessStatus } from '../../../application/auth/accessStatus.js';
import { login } from '../../../application/auth/login.js';
import { logout } from '../../../application/auth/logout.js';
import { setup } from '../../../application/auth/setup.js';
import type { LoginRequest, MeResponse, OkResponse, SetupRequest } from '../../../shared/api.js';
import { accessDto } from '../dto/access.js';
import { OK } from '../dto/ok.js';
import type { RouteModule } from '../routeModule.js';
import { loginSchema, setupSchema } from '../schemas/auth.js';
import { clearSessionCookie, keepSessionCookie, sessionTokenOf } from '../sessionCookie.js';

const originOf = (request: FastifyRequest): string => `${request.protocol}://${request.host}`;

export const authRoutes: RouteModule = (server, { ports }) => {
  server.get('/api/me', async (request, reply): Promise<MeResponse> => {
    const token = sessionTokenOf(request);
    const status = accessStatus(ports, token);
    if (status.authenticated && token !== undefined) {
      keepSessionCookie(request, reply, token);
    }
    return accessDto(status);
  });

  server.post<{ Body: SetupRequest }>('/api/setup', { schema: setupSchema }, async (request, reply): Promise<OkResponse> => {
    const session = setup(ports, {
      setupCode: request.body.setupCode ?? '',
      password: request.body.password ?? '',
      clientAddress: request.ip,
      origin: originOf(request),
    });
    keepSessionCookie(request, reply, session.token);
    return OK;
  });

  server.post<{ Body: LoginRequest }>('/api/login', { schema: loginSchema }, async (request, reply): Promise<OkResponse> => {
    const session = login(ports, { password: request.body.password ?? '', clientAddress: request.ip, origin: originOf(request) });
    keepSessionCookie(request, reply, session.token);
    return OK;
  });

  server.post('/api/logout', async (request, reply): Promise<OkResponse> => {
    const token = sessionTokenOf(request);
    if (token !== undefined) {
      logout(ports, token);
    }
    clearSessionCookie(reply);
    return OK;
  });
};
