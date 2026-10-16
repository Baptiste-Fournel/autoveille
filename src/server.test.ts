import net, { type AddressInfo } from 'node:net';
import type { FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Store } from './db.js';
import { buildServer } from './server.js';

const statusOfRawRequest = (port: number, request: string): Promise<number> =>
  new Promise((resolve, reject) => {
    let response = '';
    const socket = net.connect(port, '127.0.0.1', () => socket.write(request));
    socket.on('data', (chunk) => { response += chunk; });
    socket.on('end', () => resolve(Number(response.split(' ')[1])));
    socket.on('error', reject);
  });

describe('access without a session', () => {
  let store: Store;
  let app: FastifyInstance;

  beforeEach(async () => {
    store = new Store(':memory:');
    ({ app } = await buildServer({ store }));
  });

  afterEach(async () => {
    await app.close();
  });

  it('lets the login screen ask whether someone is signed in', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/me' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ authenticated: false });
  });

  it('refuses the settings asked with a percent-encoded address (/%61pi/settings)', async () => {
    const res = await app.inject({ method: 'GET', url: '/%61pi/settings' });
    expect(res.statusCode).toBe(401);
  });

  it('refuses the settings asked with an absolute address (GET http://host/api/settings)', async () => {
    await app.listen({ port: 0, host: '127.0.0.1' });
    const { port } = app.server.address() as AddressInfo;
    const status = await statusOfRawRequest(port, `GET http://127.0.0.1:${port}/api/settings HTTP/1.1\r\nHost: 127.0.0.1:${port}\r\nConnection: close\r\n\r\n`);
    expect(status).toBe(401);
  });

  it('does not try the saved Gmail app password on a server chosen by someone sending an encoded address', async () => {
    const settings = store.getSettings();
    store.saveSettings({ ...settings, imap: { ...settings.imap, user: 'veille.garage@gmail.com', pass: 'abcd efgh ijkl mnop' } });
    let connections = 0;
    const attacker = net.createServer((socket) => { connections += 1; socket.destroy(); });
    await new Promise<void>((resolve) => attacker.listen(0, '127.0.0.1', resolve));
    const { port } = attacker.address() as AddressInfo;

    try {
      const res = await app.inject({ method: 'POST', url: '/%61pi/sources/imap/test', payload: { host: '127.0.0.1', port, pass: '••••••••' } });
      expect(res.statusCode).toBe(401);
      expect(connections).toBe(0);
    } finally {
      await new Promise((resolve) => attacker.close(resolve));
    }
  });

  it('still lets the one-off import read in another site’s page through with its token instead of a session', async () => {
    const token = 'a'.repeat(48);
    store.setSecret('import_token', token);
    const res = await app.inject({ method: 'POST', url: '/api/import', headers: { 'content-type': 'text/plain' }, payload: JSON.stringify({ token, listings: [] }) });
    expect(res.json()).toEqual({ error: 'Aucune annonce à importer.' });
  });
});
