import Fastify, { type FastifyReply, type FastifyRequest } from 'fastify';
import fastifyCookie from '@fastify/cookie';
import fastifyStatic from '@fastify/static';
import { randomBytes } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import webpush from 'web-push';
import { config } from './config.js';
import { Store } from './db.js';
import { Pipeline } from './pipeline.js';
import { AppNotifier } from './notify/notify.js';
import { Scheduler, friendlyImapError } from './scheduler.js';
import { AttemptLimiter, ensureSecret, hashPassword, verifyPassword } from './auth.js';
import { registerApi } from './api.js';
import { seedDemo } from './demo.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.resolve(here, '..', 'public');

const isApiAddress = (address: string) => address.startsWith('/api/');
// The router decodes the address (/%61pi/settings) and accepts the absolute form (http://host/api/settings):
// access is decided on the route it found, the raw address only when no API route matched.
const addressOf = (req: FastifyRequest): string => {
  const route = req.routeOptions.url;
  return route && isApiAddress(route) ? route : req.url.split('?')[0];
};

export async function buildServer(opts: { dataDir?: string; store?: Store } = {}) {
  const store = opts.store ?? new Store(path.join(opts.dataDir ?? config.dataDir, 'autoveille.sqlite'));
  const cookieSecret = ensureSecret(store, 'cookie_secret');
  if (!store.secret('vapid_public')) {
    const keys = webpush.generateVAPIDKeys();
    store.setSecret('vapid_public', keys.publicKey);
    store.setSecret('vapid_private', keys.privateKey);
  }
  if (config.appPassword && !store.secret('password_hash')) store.setSecret('password_hash', hashPassword(config.appPassword));

  const app = Fastify({ logger: { level: 'info' }, disableRequestLogging: true, trustProxy: true });
  await app.register(fastifyCookie, { secret: cookieSecret });
  await app.register(fastifyStatic, { root: publicDir, prefix: '/', cacheControl: false });
  app.addHook('onSend', async (req, reply) => {
    if (!isApiAddress(addressOf(req)) && !reply.getHeader('cache-control')) reply.header('cache-control', /\.(png|svg|woff2?)$/.test(req.url) ? 'public, max-age=86400' : 'no-cache');
  });

  const notifier = new AppNotifier(store, {
    baseUrl: () => config.baseUrl || store.secret('base_url') || `http://localhost:${config.port}`,
    vapidPublicKey: store.secret('vapid_public')!,
    vapidPrivateKey: store.secret('vapid_private')!,
    contactEmail: config.contactEmail,
  });
  const pipeline = new Pipeline(store, notifier);
  const scheduler = new Scheduler(store, pipeline, (m) => app.log.info(m));
  const limiter = new AttemptLimiter();

  const COOKIE = 'av_session';
  const sessionOf = (req: FastifyRequest): string | undefined => {
    const raw = req.cookies[COOKIE];
    if (!raw) return undefined;
    const un = req.unsignCookie(raw);
    return un.valid && un.value && store.hasSession(un.value) ? un.value : undefined;
  };
  const setSession = (req: FastifyRequest, reply: FastifyReply) => {
    const token = randomBytes(32).toString('hex');
    store.createSession(token);
    reply.setCookie(COOKIE, token, { path: '/', httpOnly: true, sameSite: 'lax', secure: req.protocol === 'https', signed: true, maxAge: 400 * 86400 });
    if (!config.baseUrl && !store.secret('base_url')) store.setSecret('base_url', `${req.protocol}://${req.headers.host}`);
  };
  const needsSetup = () => !store.secret('password_hash');

  app.addHook('onRequest', async (req, reply) => {
    const path = addressOf(req);
    if (!isApiAddress(path)) return;
    if (['/api/me', '/api/login', '/api/setup'].includes(path)) return;
    // The one-off import may come from another site's page (a search page read in the browser): it carries
    // the import token in its body instead of the session cookie, and is checked by its handler.
    if ((path === '/api/import' || path === '/api/import/dates') && req.method === 'POST' && (req.headers['content-type'] ?? '').startsWith('text/plain')) return;
    if (!sessionOf(req)) return reply.code(401).send({ error: 'non connecté' });
  });

  // A text/plain body is a JSON payload sent without a CORS preflight (see /api/import).
  app.addContentTypeParser('text/plain', { parseAs: 'string' }, (_req, body, done) => {
    try { done(null, JSON.parse(String(body))); } catch { done(null, {}); }
  });

  app.get('/api/me', async (req) => ({ authenticated: Boolean(sessionOf(req)), needsSetup: needsSetup(), setupCodeRequired: Boolean(config.setupCode) }));

  app.post<{ Body: { setupCode?: string; password?: string } }>('/api/setup', async (req, reply) => {
    if (!needsSetup()) return reply.code(409).send({ error: 'Le mot de passe est déjà défini.' });
    const key = `setup:${req.ip}`;
    if (limiter.blocked(key)) return reply.code(429).send({ error: 'Trop d’essais, réessayez dans dix minutes.' });
    const { setupCode = '', password = '' } = req.body ?? {};
    const local = ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(req.ip);
    if (config.setupCode ? setupCode.trim() !== config.setupCode : !local) { limiter.fail(key); return reply.code(403).send({ error: 'Code de première connexion incorrect.' }); }
    if (password.length < 8) return reply.code(400).send({ error: 'Choisissez un mot de passe d’au moins 8 caractères.' });
    store.setSecret('password_hash', hashPassword(password));
    limiter.reset(key);
    setSession(req, reply);
    return { ok: true };
  });

  app.post<{ Body: { password?: string } }>('/api/login', async (req, reply) => {
    const key = `login:${req.ip}`;
    if (limiter.blocked(key)) return reply.code(429).send({ error: 'Trop d’essais, réessayez dans dix minutes.' });
    const hash = store.secret('password_hash');
    if (!hash) return reply.code(409).send({ error: 'Première connexion : choisissez d’abord un mot de passe.', needsSetup: true });
    if (!verifyPassword(req.body?.password ?? '', hash)) { limiter.fail(key); return reply.code(401).send({ error: 'Mot de passe incorrect.' }); }
    limiter.reset(key);
    setSession(req, reply);
    return { ok: true };
  });

  app.post('/api/logout', async (req, reply) => {
    const s = sessionOf(req);
    if (s) store.deleteSession(s);
    reply.clearCookie(COOKIE, { path: '/' });
    return { ok: true };
  });

  registerApi(app, { store, pipeline, notifier, scheduler, friendlyImapError });

  app.setNotFoundHandler((req, reply) => {
    if (isApiAddress(addressOf(req))) return reply.code(404).send({ error: 'inconnu' });
    return reply.sendFile('index.html');
  });

  if (config.demo && store.counts().today === 0 && store.recentVehicles(30).length === 0) {
    await seedDemo(store, pipeline);
    app.log.info('Données de démonstration chargées (DEMO=1).');
  }

  return { app, store, pipeline, scheduler };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { app, scheduler, store } = await buildServer();
  scheduler.start(config.imapPollMinutes, config.httpPollMinutes);
  await app.listen({ port: config.port, host: config.host });
  if (!store.secret('password_hash')) app.log.info(config.setupCode ? 'Première connexion : ouvrez l’application et saisissez le code SETUP_CODE pour choisir le mot de passe.' : 'Première connexion : ouvrez l’application depuis cette machine pour choisir le mot de passe.');
}
