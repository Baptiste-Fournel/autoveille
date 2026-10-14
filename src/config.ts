import fs from 'node:fs';
import path from 'node:path';

// Minimal .env loader (no dependency). Values already set in the environment win.
function loadDotEnv(file = path.resolve(process.cwd(), '.env')): void {
  if (!fs.existsSync(file)) return;
  for (const rawLine of fs.readFileSync(file, 'utf8').split('\n')) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq < 0) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

loadDotEnv();

const env = process.env;

export const config = {
  port: Number(env.PORT ?? 3000),
  host: env.HOST ?? '127.0.0.1',
  /** Public address of the app (for links in notifications). Derived from the first login when empty. */
  baseUrl: env.BASE_URL ?? '',
  dataDir: env.DATA_DIR ?? path.resolve(process.cwd(), 'data'),
  /** One-time code required by the first-run page where the person chooses the password. */
  setupCode: env.SETUP_CODE ?? '',
  /** Optional: force the password from the environment instead of the first-run page. */
  appPassword: env.APP_PASSWORD ?? '',
  contactEmail: env.CONTACT_EMAIL ?? '',
  imapPollMinutes: Number(env.IMAP_POLL_MINUTES ?? 2),
  httpPollMinutes: Number(env.HTTP_POLL_MINUTES ?? 30),
  demo: env.DEMO === '1',
};
