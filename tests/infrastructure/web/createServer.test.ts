import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { connect } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { LightMyRequestResponse } from 'fastify';
import { describe, expect, it, onTestFinished, vi } from 'vitest';
import type { SettingsResponse } from '../../../src/shared/api.js';
import { OWNER_PASSWORD, PHONE_ADDRESS, SESSION_COOKIE, THIS_MACHINE } from '../../support/authentication.js';
import { runningApplication, signedInApplication } from '../../support/signedInApplication.js';

const DAY_MS = 86_400_000;

const SIX_MONTHS_IN_SECONDS = 180 * 86_400;

function setCookieHeader(response: LightMyRequestResponse): string {
  const header = response.headers['set-cookie'];
  const headers = Array.isArray(header) ? header : [String(header ?? '')];
  return headers.find((candidate) => candidate.startsWith(`${SESSION_COOKIE}=`)) ?? '';
}

function tokenOf(signedSession: string): string {
  return signedSession.slice(0, signedSession.lastIndexOf('.'));
}

async function rawHttpRequest(port: number, requestLine: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: string[] = [];
    const socket = connect({ host: THIS_MACHINE, port }, () => {
      socket.end(`${requestLine}\r\nHost: ${THIS_MACHINE}:${port}\r\nConnection: close\r\n\r\n`);
    });
    socket.setEncoding('utf8');
    socket.on('data', (chunk: string) => chunks.push(chunk));
    socket.on('end', () => resolve(chunks.join('')));
    socket.on('error', reject);
  });
}

describe('en-têtes de sécurité', () => {
  it('la page de l’application n’autorise que ses propres scripts et styles, et les photos des annonces en https', async () => {
    // Given
    const application = await runningApplication();

    // When
    const response = await application.server.inject({ method: 'GET', url: '/' });

    // Then
    const policy = String(response.headers['content-security-policy']).split(';');
    expect(response.statusCode).toBe(200);
    expect(policy).toEqual(
      expect.arrayContaining([
        "default-src 'self'",
        "img-src 'self' https: data:",
        "connect-src 'self'",
        "worker-src 'self'",
        "manifest-src 'self'",
        "frame-ancestors 'none'",
        "base-uri 'self'",
        "form-action 'self'",
      ]),
    );
    expect(policy.find((directive) => directive.startsWith('script-src'))).toBe("script-src 'self'");
    expect(policy.find((directive) => directive.startsWith('style-src'))).toMatch(/^style-src 'self'/);
    expect(policy.join(';')).not.toContain('unsafe-inline');
    expect(response.headers['x-content-type-options']).toBe('nosniff');
  });

  it('le thème clair ou sombre choisi sur le téléphone est appliqué avant l’affichage par un script servi par l’application, la page n’ayant plus de script en ligne', async () => {
    // Given
    const application = await runningApplication();

    // When
    const page = await application.server.inject({ method: 'GET', url: '/' });
    const themeScript = await application.server.inject({ method: 'GET', url: '/theme.js' });

    // Then
    const scripts = page.body.match(/<script[^>]*>/g) ?? [];
    expect(scripts).toEqual(['<script src="/theme.js">', '<script src="/app.js" defer>']);
    expect(themeScript.statusCode).toBe(200);
    expect(themeScript.headers['content-type']).toMatch(/^text\/javascript|^application\/javascript/);
    expect(themeScript.body).toContain("localStorage.getItem('av_theme')");
  });

  it('une réponse de l’API refusée faute de session porte aussi les en-têtes de sécurité', async () => {
    // Given
    const application = await runningApplication();

    // When
    const response = await application.server.inject({ method: 'GET', url: '/api/overview' });

    // Then
    expect(response.statusCode).toBe(401);
    expect(response.headers['content-security-policy']).toContain("default-src 'self'");
  });
});

describe('mise en cache des fichiers de l’application', () => {
  it('l’icône que l’iPhone demande d’office à la racine, absente, renvoie la page sans la garder un jour en cache', async () => {
    // Given
    const application = await runningApplication();

    // When
    const response = await application.server.inject({ method: 'GET', url: '/apple-touch-icon.png' });

    // Then
    expect(response.statusCode).toBe(200);
    expect(response.headers['content-type']).toMatch(/^text\/html/);
    expect(response.headers['cache-control']).toBe('no-cache');
  });

  it('un script haché du build est gardé un an sans revalidation, la page toujours revalidée', async () => {
    // Given
    const builtClient = mkdtempSync(join(tmpdir(), 'autoveille-client-'));
    onTestFinished(() => rmSync(builtClient, { recursive: true, force: true }));
    mkdirSync(join(builtClient, 'assets'));
    writeFileSync(
      join(builtClient, 'index.html'),
      '<!doctype html><title>AutoVeille</title><script type="module" src="/assets/app-3f9a1c.js"></script>',
    );
    writeFileSync(join(builtClient, 'assets', 'app-3f9a1c.js'), 'export {};');
    const application = await runningApplication({ staticDirectory: builtClient });

    // When
    const script = await application.server.inject({ method: 'GET', url: '/assets/app-3f9a1c.js' });
    const page = await application.server.inject({ method: 'GET', url: '/' });

    // Then
    expect(script.headers['cache-control']).toBe('public, max-age=31536000, immutable');
    expect(page.headers['cache-control']).toBe('no-cache');
  });
});

describe('sonde de santé', () => {
  it('la surveillance du serveur interroge la sonde sans session et obtient seulement « ok »', async () => {
    // Given
    const application = await runningApplication();

    // When
    const response = await application.server.inject({ method: 'GET', url: '/api/health' });

    // Then
    expect({ status: response.statusCode, body: response.json() }).toEqual({ status: 200, body: { ok: true } });
  });
});

describe('sessions', () => {
  it('l’accueil demandé sans session est refusé', async () => {
    // Given
    const { application } = await signedInApplication();

    // When
    const response = await application.server.inject({ method: 'GET', url: '/api/overview' });

    // Then
    expect({ status: response.statusCode, body: response.json() }).toEqual({ status: 401, body: { error: 'non connecté' } });
  });

  it('un téléphone qui n’a pas ouvert l’application depuis six mois et un jour doit se reconnecter', async () => {
    // Given
    const { application, session } = await signedInApplication();
    application.clock.advanceBy(181 * DAY_MS);

    // When
    const response = await application.server.inject({ method: 'GET', url: '/api/overview', headers: session });

    // Then
    expect({ status: response.statusCode, body: response.json() }).toEqual({ status: 401, body: { error: 'non connecté' } });
  });

  it('le concessionnaire qui ouvre l’application chaque mois reste connecté au-delà de six mois', async () => {
    // Given
    const { application, session } = await signedInApplication();
    for (const month of [1, 2, 3, 4, 5, 6, 7]) {
      application.clock.advanceBy(30 * DAY_MS);
      await application.server.inject({ method: 'GET', url: `/api/overview?mois=${month}`, headers: session });
    }

    // When
    application.clock.advanceBy(30 * DAY_MS);
    const response = await application.server.inject({ method: 'GET', url: '/api/me', headers: session });

    // Then
    expect(response.json()).toEqual({ authenticated: true, needsSetup: false, setupCodeRequired: false });
  });

  it('chaque requête authentifiée renvoie le cookie de session pour six mois de plus', async () => {
    // Given
    const { application, session, signedSession } = await signedInApplication();
    application.clock.advanceBy(90 * DAY_MS);

    // When
    const response = await application.server.inject({ method: 'GET', url: '/api/overview', headers: session });

    // Then
    expect(setCookieHeader(response)).toBe(
      `${SESSION_COOKIE}=${signedSession}; Max-Age=${SIX_MONTHS_IN_SECONDS}; Path=/; HttpOnly; SameSite=Lax`,
    );
  });

  it('au redémarrage du serveur, les sessions échues sont effacées de la base', async () => {
    // Given
    const { application, signedSession } = await signedInApplication();
    const token = tokenOf(signedSession);
    application.clock.advanceBy(181 * DAY_MS);

    // When
    await application.start();

    // Then
    expect(application.ports.sessions.find(token)).toBeUndefined();
  });

  it('la nuit qui suit l’échéance, la session d’un appareil jamais revenu est effacée de la base', async () => {
    // Given
    const { application, signedSession } = await signedInApplication();
    const token = tokenOf(signedSession);
    await application.start();
    application.clock.advanceBy(181 * DAY_MS);
    const kept = application.ports.sessions.find(token);

    // When
    application.timers.advanceBy(DAY_MS);

    // Then
    expect(kept).toBeDefined();
    expect(application.ports.sessions.find(token)).toBeUndefined();
  });

  it('le disque du serveur plein pendant le nettoyage de la nuit est signalé au journal comme un échec du nettoyage, sans arrêter le serveur', async () => {
    // Given
    const application = await runningApplication();
    await application.start();
    vi.spyOn(application.ports.sessions, 'deleteExpired').mockImplementation(() => {
      throw new Error('database or disk is full');
    });
    const journal = vi.spyOn(application.server.log, 'error');

    // When
    application.timers.advanceBy(DAY_MS);
    const probe = await application.server.inject({ method: 'GET', url: '/api/health' });

    // Then
    expect(journal.mock.calls).toEqual([['nettoyage des sessions en échec : database or disk is full']]);
    expect(probe.statusCode).toBe(200);
  });
});

describe('adresses de l’API écrites autrement', () => {
  it('une requête sans session qui encode une lettre de /api (/%61pi/settings) est refusée', async () => {
    // Given
    const { application } = await signedInApplication();

    // When
    const response = await application.server.inject({ method: 'GET', url: '/%61pi/settings' });

    // Then
    expect({ status: response.statusCode, body: response.json() }).toEqual({ status: 401, body: { error: 'non connecté' } });
  });

  it('des réglages envoyés sans session à /%61pi/settings pour détourner la boîte Gmail vers un autre serveur sont refusés, et la boîte reste celle enregistrée', async () => {
    // Given
    const { application, session } = await signedInApplication();
    const stored = await application.server.inject({ method: 'GET', url: '/api/settings', headers: session });
    const settings = stored.json<SettingsResponse>().settings;

    // When
    const response = await application.server.inject({
      method: 'PUT',
      url: '/%61pi/settings',
      payload: { ...settings, imap: { ...settings.imap, host: 'imap.attaquant.example' } },
    });

    // Then
    expect({ status: response.statusCode, body: response.json() }).toEqual({ status: 401, body: { error: 'non connecté' } });
    expect(application.ports.settings.load().imap.host).toBe(settings.imap.host);
  });

  it('le jeton d’import demandé sans session à /%61pi/import/token est refusé', async () => {
    // Given
    const { application } = await signedInApplication();

    // When
    const response = await application.server.inject({ method: 'GET', url: '/%61pi/import/token' });

    // Then
    expect({ status: response.statusCode, body: response.json() }).toEqual({ status: 401, body: { error: 'non connecté' } });
  });

  it('une requête sans session qui écrit l’adresse complète du serveur (GET http://hôte/api/settings) est refusée', async () => {
    // Given
    const { application } = await signedInApplication();
    await application.server.listen({ host: THIS_MACHINE, port: 0 });
    const port = application.server.addresses()[0]?.port ?? 0;

    // When
    const answer = await rawHttpRequest(port, `GET http://${THIS_MACHINE}:${port}/api/settings HTTP/1.1`);

    // Then
    expect(answer.split('\r\n')[0]).toBe('HTTP/1.1 401 Unauthorized');
    expect(answer).toContain('{"error":"non connecté"}');
  });
});

describe('derrière le proxy', () => {
  it('derrière Caddy sur la même machine, une première connexion en HTTPS pose un cookie réservé à HTTPS', async () => {
    // Given
    const application = await runningApplication();

    // When
    const response = await application.server.inject({
      method: 'POST',
      url: '/api/setup',
      payload: { password: OWNER_PASSWORD },
      headers: { 'x-forwarded-proto': 'https' },
    });

    // Then
    expect(setCookieHeader(response)).toMatch(/; HttpOnly; Secure; SameSite=Lax$/);
  });

  it('une requête venue d’Internet qui se dit relayée pour 127.0.0.1 ne passe pas pour la machine elle-même', async () => {
    // Given
    const application = await runningApplication();

    // When
    const response = await application.server.inject({
      method: 'POST',
      url: '/api/setup',
      payload: { password: OWNER_PASSWORD },
      remoteAddress: PHONE_ADDRESS,
      headers: { 'x-forwarded-for': '127.0.0.1' },
    });

    // Then
    expect({ status: response.statusCode, body: response.json() }).toEqual({
      status: 403,
      body: { error: 'Code de première connexion incorrect.' },
    });
    expect(setCookieHeader(response)).toBe('');
  });
});
