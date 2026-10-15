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
ALTER TABLE listings ADD COLUMN description TEXT;
ALTER TABLE vehicles ADD COLUMN note TEXT;
ALTER TABLE vehicles ADD COLUMN published_at TEXT;
