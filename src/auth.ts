import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import type { Store } from './db.js';

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(':');
  if (!salt || !hash) return false;
  const a = scryptSync(password, salt, 64);
  const b = Buffer.from(hash, 'hex');
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Simple per-key attempt limiter (login and setup): 8 tries, then a 10 minute cool-down. */
export class AttemptLimiter {
  private readonly hits = new Map<string, { count: number; until: number }>();
  constructor(private readonly max = 8, private readonly windowMs = 10 * 60_000) {}
  blocked(key: string): boolean {
    const h = this.hits.get(key);
    if (!h) return false;
    if (Date.now() > h.until) { this.hits.delete(key); return false; }
    return h.count >= this.max;
  }
  fail(key: string): void {
    const h = this.hits.get(key);
    if (!h || Date.now() > h.until) this.hits.set(key, { count: 1, until: Date.now() + this.windowMs });
    else h.count++;
  }
  reset(key: string): void { this.hits.delete(key); }
}

export function ensureSecret(store: Store, key: string, bytes = 32): string {
  const existing = store.secret(key);
  if (existing) return existing;
  const value = randomBytes(bytes).toString('hex');
  store.setSecret(key, value);
  return value;
}
