import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import type { AlertInfo, Family, RawListing, SellerType, Settings, Status } from './types.js';
import { defaultSettings, mergeSettings } from './listings/defaults.js';
import { recordAlertConfirmation } from './domain/settings/alerts.js';

export interface VehicleRow {
  id: number;
  fingerprint: string;
  make: string | null;
  model: string | null;
  family: Family;
  year: number | null;
  km: number | null;
  price: number | null;
  city: string | null;
  postal_code: string | null;
  lat: number | null;
  lon: number | null;
  distance_km: number | null;
  status: Status;
  do_not_contact: number;
  matched: number;
  reasons: string; // JSON string[]
  message_override: string | null;
  first_seen_at: string;
  last_seen_at: string;
  notified_at: string | null;
  price_dropped: number;
  reposted: number;
  /** Free text the person keeps on the vehicle (an appointment, the price asked...). */
  note: string | null;
  /** When the listing was published on the site (earliest known), used for display and ordering. */
  published_at: string | null;
}

export interface ListingRow {
  id: number;
  vehicle_id: number;
  site: string;
  site_label: string;
  external_id: string;
  url: string;
  title: string;
  price: number | null;
  km: number | null;
  year: number | null;
  city: string | null;
  postal_code: string | null;
  seller_type: SellerType;
  image_url: string | null;
  /** Text of the listing as it appeared in the alert email or page (an excerpt, for the in-app view). */
  description: string | null;
  published_at: string | null;
  source_ref: string | null;
  first_seen_at: string;
  last_seen_at: string;
}

export interface EventRow { id: number; vehicle_id: number; type: string; detail: string | null; at: string }

export class Store {
  readonly db: Database.Database;

  constructor(file: string) {
    if (file !== ':memory:') fs.mkdirSync(path.dirname(file), { recursive: true });
    this.db = new Database(file);
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('foreign_keys = ON');
    this.migrate();
  }

  private migrate(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, json TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS vehicles (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        fingerprint TEXT NOT NULL,
        make TEXT, model TEXT, family TEXT NOT NULL, year INTEGER, km INTEGER, price INTEGER,
        city TEXT, postal_code TEXT, lat REAL, lon REAL, distance_km REAL,
        status TEXT NOT NULL DEFAULT 'nouveau',
        do_not_contact INTEGER NOT NULL DEFAULT 0,
        matched INTEGER NOT NULL DEFAULT 0,
        reasons TEXT NOT NULL DEFAULT '[]',
        message_override TEXT,
        first_seen_at TEXT NOT NULL, last_seen_at TEXT NOT NULL, notified_at TEXT,
        price_dropped INTEGER NOT NULL DEFAULT 0, reposted INTEGER NOT NULL DEFAULT 0
      );
      CREATE TABLE IF NOT EXISTS listings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        vehicle_id INTEGER NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
        site TEXT NOT NULL, site_label TEXT NOT NULL, external_id TEXT NOT NULL, url TEXT NOT NULL,
        title TEXT NOT NULL, price INTEGER, km INTEGER, year INTEGER, city TEXT, postal_code TEXT,
        seller_type TEXT NOT NULL DEFAULT 'inconnu', image_url TEXT, published_at TEXT, source_ref TEXT,
        first_seen_at TEXT NOT NULL, last_seen_at TEXT NOT NULL,
        UNIQUE(site, external_id)
      );
      CREATE INDEX IF NOT EXISTS idx_listings_vehicle ON listings(vehicle_id);
      CREATE INDEX IF NOT EXISTS idx_vehicles_fp ON vehicles(fingerprint);
      CREATE TABLE IF NOT EXISTS price_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        listing_id INTEGER NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
        price INTEGER NOT NULL, seen_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        vehicle_id INTEGER NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
        type TEXT NOT NULL, detail TEXT, at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_events_vehicle ON events(vehicle_id);
      CREATE TABLE IF NOT EXISTS emails_processed (
        message_id TEXT PRIMARY KEY, uid INTEGER, subject TEXT, sender TEXT, received_at TEXT,
        site TEXT, parsed_count INTEGER NOT NULL DEFAULT 0, parsed_json TEXT, error TEXT, processed_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS mail_state (mailbox TEXT PRIMARY KEY, last_uid INTEGER NOT NULL DEFAULT 0, uid_validity INTEGER);
      CREATE TABLE IF NOT EXISTS push_subscriptions (endpoint TEXT PRIMARY KEY, json TEXT NOT NULL, created_at TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS sessions (token TEXT PRIMARY KEY, created_at TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS geo_cache (key TEXT PRIMARY KEY, json TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS source_runs (source TEXT PRIMARY KEY, last_run_at TEXT, ok INTEGER NOT NULL DEFAULT 1, detail TEXT);
      CREATE TABLE IF NOT EXISTS secrets (key TEXT PRIMARY KEY, value TEXT NOT NULL);
    `);
    // Colonnes ajoutées après la première version : ajout sans perte sur une base existante.
    const cols = (this.db.prepare('PRAGMA table_info(listings)').all() as Array<{ name: string }>).map((c) => c.name);
    if (!cols.includes('description')) this.db.exec('ALTER TABLE listings ADD COLUMN description TEXT');
    const vcols = (this.db.prepare('PRAGMA table_info(vehicles)').all() as Array<{ name: string }>).map((c) => c.name);
    if (!vcols.includes('note')) this.db.exec('ALTER TABLE vehicles ADD COLUMN note TEXT');
    if (!vcols.includes('published_at')) this.db.exec('ALTER TABLE vehicles ADD COLUMN published_at TEXT');
  }

  // ---------- settings ----------
  getSettings(): Settings {
    const row = this.db.prepare('SELECT json FROM settings WHERE key = ?').get('main') as { json: string } | undefined;
    if (!row) return defaultSettings();
    try {
      return mergeSettings(JSON.parse(row.json));
    } catch {
      return defaultSettings();
    }
  }

  saveSettings(s: Settings): void {
    this.db.prepare('INSERT INTO settings(key, json) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET json = excluded.json').run('main', JSON.stringify(s));
  }

  // ---------- vehicles & listings ----------
  findListing(site: string, externalId: string): ListingRow | undefined {
    return this.db.prepare('SELECT * FROM listings WHERE site = ? AND external_id = ?').get(site, externalId) as ListingRow | undefined;
  }

  findVehiclesByFingerprint(fp: string): VehicleRow[] {
    return this.db.prepare('SELECT * FROM vehicles WHERE fingerprint = ? ORDER BY last_seen_at DESC').all(fp) as VehicleRow[];
  }

  getVehicle(id: number): VehicleRow | undefined {
    return this.db.prepare('SELECT * FROM vehicles WHERE id = ?').get(id) as VehicleRow | undefined;
  }

  insertVehicle(v: Omit<VehicleRow, 'id'>): number {
    const r = this.db.prepare(`INSERT INTO vehicles (fingerprint, make, model, family, year, km, price, city, postal_code, lat, lon, distance_km, status, do_not_contact, matched, reasons, message_override, first_seen_at, last_seen_at, notified_at, price_dropped, reposted, note, published_at)
      VALUES (@fingerprint, @make, @model, @family, @year, @km, @price, @city, @postal_code, @lat, @lon, @distance_km, @status, @do_not_contact, @matched, @reasons, @message_override, @first_seen_at, @last_seen_at, @notified_at, @price_dropped, @reposted, @note, @published_at)`).run(v);
    return Number(r.lastInsertRowid);
  }

  insertListing(l: Omit<ListingRow, 'id'>): number {
    const r = this.db.prepare(`INSERT INTO listings (vehicle_id, site, site_label, external_id, url, title, price, km, year, city, postal_code, seller_type, image_url, description, published_at, source_ref, first_seen_at, last_seen_at)
      VALUES (@vehicle_id, @site, @site_label, @external_id, @url, @title, @price, @km, @year, @city, @postal_code, @seller_type, @image_url, @description, @published_at, @source_ref, @first_seen_at, @last_seen_at)`).run(l);
    const id = Number(r.lastInsertRowid);
    if (l.price !== null && l.price !== undefined) this.db.prepare('INSERT INTO price_history(listing_id, price, seen_at) VALUES (?, ?, ?)').run(id, l.price, l.first_seen_at);
    return id;
  }

  touchListing(id: number, at: string, price: number | null): void {
    this.db.prepare('UPDATE listings SET last_seen_at = ?, price = COALESCE(?, price) WHERE id = ?').run(at, price, id);
    this.db.prepare('UPDATE vehicles SET last_seen_at = ? WHERE id = (SELECT vehicle_id FROM listings WHERE id = ?)').run(at, id);
  }

  recordPrice(listingId: number, price: number, at: string): void {
    this.db.prepare('INSERT INTO price_history(listing_id, price, seen_at) VALUES (?, ?, ?)').run(listingId, price, at);
  }

  priceHistory(listingId: number): Array<{ price: number; seen_at: string }> {
    return this.db.prepare('SELECT price, seen_at FROM price_history WHERE listing_id = ? ORDER BY seen_at').all(listingId) as Array<{ price: number; seen_at: string }>;
  }

  addEvent(vehicleId: number, type: string, detail: string | null, at: string): void {
    this.db.prepare('INSERT INTO events(vehicle_id, type, detail, at) VALUES (?, ?, ?, ?)').run(vehicleId, type, detail, at);
  }

  events(vehicleId: number): EventRow[] {
    return this.db.prepare('SELECT * FROM events WHERE vehicle_id = ? ORDER BY at DESC, id DESC').all(vehicleId) as EventRow[];
  }

  updateVehicle(id: number, patch: Partial<VehicleRow>): void {
    const keys = Object.keys(patch) as Array<keyof VehicleRow>;
    if (!keys.length) return;
    const sets = keys.map((k) => `${k} = @${k}`).join(', ');
    this.db.prepare(`UPDATE vehicles SET ${sets} WHERE id = @id`).run({ ...patch, id });
  }

  updateListing(id: number, patch: Partial<ListingRow>): void {
    const keys = Object.keys(patch) as Array<keyof ListingRow>;
    if (!keys.length) return;
    const sets = keys.map((k) => `${k} = @${k}`).join(', ');
    this.db.prepare(`UPDATE listings SET ${sets} WHERE id = @id`).run({ ...patch, id });
  }

  /**
   * Records the date a known listing went online on its site. The site is the authority for its own
   * listing; the vehicle keeps the earliest date among its listings. Returns false for an unknown listing.
   */
  setPublishedAt(site: string, externalId: string, publishedAt: string): boolean {
    const listing = this.findListing(site, externalId);
    if (!listing) return false;
    this.db.prepare('UPDATE listings SET published_at = ? WHERE id = ?').run(publishedAt, listing.id);
    this.db.prepare('UPDATE vehicles SET published_at = ? WHERE id = ? AND (published_at IS NULL OR published_at > ?)').run(publishedAt, listing.vehicle_id, publishedAt);
    return true;
  }

  /** Removes one vehicle with its listings, prices and events (a wrongly read email, say). */
  deleteVehicle(id: number): void {
    this.db.prepare('DELETE FROM vehicles WHERE id = ?').run(id);
  }

  /** When the vehicle last entered a status (contacted, replied...), from the events. */
  /** Forgets events of the given types: a status set by mistake and undone leaves no trace in the counts. */
  deleteEvents(vehicleId: number, types: string[]): void {
    if (!types.length) return;
    this.db.prepare(`DELETE FROM events WHERE vehicle_id = ? AND type IN (${types.map(() => '?').join(',')})`).run(vehicleId, ...types);
  }

  lastEventAt(vehicleId: number, type: string): string | null {
    const r = this.db.prepare('SELECT at FROM events WHERE vehicle_id = ? AND type = ? ORDER BY at DESC LIMIT 1').get(vehicleId, type) as { at: string } | undefined;
    return r?.at ?? null;
  }

  /** The week at a glance: listings kept by the filters, contacts made, answers received. */
  weekStats(days = 7): { received: number; contacted: number; replied: number } {
    const since = new Date(Date.now() - days * 86400_000).toISOString();
    const received = (this.db.prepare('SELECT COUNT(*) n FROM vehicles WHERE matched = 1 AND first_seen_at >= ?').get(since) as { n: number }).n;
    const contacted = (this.db.prepare("SELECT COUNT(DISTINCT vehicle_id) n FROM events WHERE type = 'statut_contacte' AND at >= ?").get(since) as { n: number }).n;
    const replied = (this.db.prepare("SELECT COUNT(DISTINCT vehicle_id) n FROM events WHERE type = 'statut_repondu' AND at >= ?").get(since) as { n: number }).n;
    return { received, contacted, replied };
  }

  recordAlert(info: AlertInfo): void {
    const s = this.getSettings();
    const next = recordAlertConfirmation(s, info);
    if (next !== s) this.saveSettings(next);
  }

  /** Forget which emails were read, so the next check reads the mailbox again from the start. */
  resetMailbox(): void {
    this.db.prepare('DELETE FROM emails_processed').run();
    this.db.prepare('UPDATE mail_state SET last_uid = 0').run();
  }

  listingsOfVehicle(vehicleId: number): ListingRow[] {
    return this.db.prepare('SELECT * FROM listings WHERE vehicle_id = ? ORDER BY first_seen_at').all(vehicleId) as ListingRow[];
  }

  /** Vehicles for the main screen: matched ones, newest first. `status` filters; `all` includes unmatched ones. */
  listVehicles(opts: { status?: Status | 'tous'; onlyMatched?: boolean; sinceDays?: number; limit?: number }): VehicleRow[] {
    const where: string[] = [];
    const params: Record<string, unknown> = {};
    if (opts.onlyMatched !== false) where.push('matched = 1');
    if (opts.status && opts.status !== 'tous') { where.push('status = @status'); params.status = opts.status; }
    if (opts.sinceDays) { where.push('first_seen_at >= @since'); params.since = new Date(Date.now() - opts.sinceDays * 86400_000).toISOString(); }
    // Newest listings first, by the date the site published them when it is known.
    const sql = `SELECT * FROM vehicles ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY COALESCE(published_at, first_seen_at) DESC LIMIT @limit`;
    return this.db.prepare(sql).all({ ...params, limit: opts.limit ?? 200 }) as VehicleRow[];
  }

  recentVehicles(days: number): VehicleRow[] {
    return this.db.prepare('SELECT * FROM vehicles WHERE first_seen_at >= ? ORDER BY first_seen_at DESC').all(new Date(Date.now() - days * 86400_000).toISOString()) as VehicleRow[];
  }

  allVehicles(): VehicleRow[] {
    return this.db.prepare('SELECT * FROM vehicles ORDER BY id').all() as VehicleRow[];
  }

  /** Runs several writes as one transaction (all or nothing). */
  transaction<T>(fn: () => T): T {
    return this.db.transaction(fn)();
  }

  firstListingOfVehicle(vehicleId: number): ListingRow | undefined {
    return this.db.prepare('SELECT * FROM listings WHERE vehicle_id = ? ORDER BY first_seen_at LIMIT 1').get(vehicleId) as ListingRow | undefined;
  }

  counts(): { nouveau: number; contacte: number; repondu: number; ignore: number; today: number } {
    const by = this.db.prepare('SELECT status, COUNT(*) c FROM vehicles WHERE matched = 1 GROUP BY status').all() as Array<{ status: Status; c: number }>;
    const out = { nouveau: 0, contacte: 0, repondu: 0, ignore: 0, today: 0 };
    for (const r of by) out[r.status] = r.c;
    const start = new Date(); start.setHours(0, 0, 0, 0);
    out.today = (this.db.prepare('SELECT COUNT(*) c FROM vehicles WHERE matched = 1 AND first_seen_at >= ?').get(start.toISOString()) as { c: number }).c;
    return out;
  }

  // ---------- email ingestion state ----------
  emailProcessed(messageId: string): boolean {
    return !!this.db.prepare('SELECT 1 FROM emails_processed WHERE message_id = ?').get(messageId);
  }

  markEmail(row: { message_id: string; uid: number | null; subject: string; sender: string; received_at: string | null; site: string | null; parsed_count: number; parsed_json: string | null; error: string | null }): void {
    this.db.prepare(`INSERT INTO emails_processed(message_id, uid, subject, sender, received_at, site, parsed_count, parsed_json, error, processed_at)
      VALUES (@message_id, @uid, @subject, @sender, @received_at, @site, @parsed_count, @parsed_json, @error, @processed_at)
      ON CONFLICT(message_id) DO UPDATE SET parsed_count = excluded.parsed_count, parsed_json = excluded.parsed_json, error = excluded.error, processed_at = excluded.processed_at`)
      .run({ ...row, processed_at: new Date().toISOString() });
  }

  recentEmails(limit = 30): Array<{ message_id: string; subject: string; sender: string; received_at: string | null; site: string | null; parsed_count: number; parsed_json: string | null; error: string | null; processed_at: string }> {
    return this.db.prepare('SELECT message_id, subject, sender, received_at, site, parsed_count, parsed_json, error, processed_at FROM emails_processed ORDER BY processed_at DESC LIMIT ?').all(limit) as never;
  }

  mailState(mailbox: string): { last_uid: number; uid_validity: number | null } {
    const r = this.db.prepare('SELECT last_uid, uid_validity FROM mail_state WHERE mailbox = ?').get(mailbox) as { last_uid: number; uid_validity: number | null } | undefined;
    return r ?? { last_uid: 0, uid_validity: null };
  }

  saveMailState(mailbox: string, lastUid: number, uidValidity: number | null): void {
    this.db.prepare('INSERT INTO mail_state(mailbox, last_uid, uid_validity) VALUES (?, ?, ?) ON CONFLICT(mailbox) DO UPDATE SET last_uid = excluded.last_uid, uid_validity = excluded.uid_validity').run(mailbox, lastUid, uidValidity);
  }

  // ---------- sources status ----------
  sourceRun(source: string, ok: boolean, detail: string): void {
    this.db.prepare('INSERT INTO source_runs(source, last_run_at, ok, detail) VALUES (?, ?, ?, ?) ON CONFLICT(source) DO UPDATE SET last_run_at = excluded.last_run_at, ok = excluded.ok, detail = excluded.detail')
      .run(source, new Date().toISOString(), ok ? 1 : 0, detail);
  }

  sourceRuns(): Array<{ source: string; last_run_at: string | null; ok: number; detail: string | null }> {
    return this.db.prepare('SELECT * FROM source_runs').all() as never;
  }

  // ---------- push ----------
  addPushSubscription(sub: { endpoint: string }): void {
    this.db.prepare('INSERT INTO push_subscriptions(endpoint, json, created_at) VALUES (?, ?, ?) ON CONFLICT(endpoint) DO UPDATE SET json = excluded.json').run(sub.endpoint, JSON.stringify(sub), new Date().toISOString());
  }
  removePushSubscription(endpoint: string): void {
    this.db.prepare('DELETE FROM push_subscriptions WHERE endpoint = ?').run(endpoint);
  }
  pushSubscriptions(): Array<{ endpoint: string; json: string }> {
    return this.db.prepare('SELECT endpoint, json FROM push_subscriptions').all() as never;
  }

  // ---------- sessions ----------
  createSession(token: string): void {
    this.db.prepare('INSERT INTO sessions(token, created_at) VALUES (?, ?)').run(token, new Date().toISOString());
  }
  hasSession(token: string): boolean {
    return !!this.db.prepare('SELECT 1 FROM sessions WHERE token = ?').get(token);
  }
  deleteSession(token: string): void {
    this.db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
  }

  // ---------- secrets (cookie secret, VAPID keys, password hash) ----------
  secret(key: string): string | undefined {
    const r = this.db.prepare('SELECT value FROM secrets WHERE key = ?').get(key) as { value: string } | undefined;
    return r?.value;
  }
  setSecret(key: string, value: string): void {
    this.db.prepare('INSERT INTO secrets(key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').run(key, value);
  }

  // ---------- geo cache ----------
  geoGet(key: string): unknown {
    const r = this.db.prepare('SELECT json FROM geo_cache WHERE key = ?').get(key) as { json: string } | undefined;
    return r ? JSON.parse(r.json) : undefined;
  }
  geoSet(key: string, value: unknown): void {
    this.db.prepare('INSERT INTO geo_cache(key, json) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET json = excluded.json').run(key, JSON.stringify(value));
  }
}

export function rawToListingRow(raw: RawListing, vehicleId: number, now: string): Omit<ListingRow, 'id'> {
  return {
    vehicle_id: vehicleId,
    site: raw.site,
    site_label: raw.siteLabel,
    external_id: raw.externalId,
    url: raw.url,
    title: raw.title,
    price: raw.price ?? null,
    km: raw.km ?? null,
    year: raw.year ?? null,
    city: raw.city ?? null,
    postal_code: raw.postalCode ?? null,
    seller_type: raw.sellerType ?? 'inconnu',
    image_url: raw.imageUrl ?? null,
    description: raw.description?.trim() || null,
    published_at: raw.publishedAt ?? null,
    source_ref: raw.sourceRef ?? null,
    first_seen_at: now,
    last_seen_at: now,
  };
}
