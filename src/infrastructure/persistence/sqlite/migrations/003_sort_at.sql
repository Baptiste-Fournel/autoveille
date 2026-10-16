ALTER TABLE vehicles ADD COLUMN sort_at TEXT GENERATED ALWAYS AS (COALESCE(published_at, first_seen_at)) VIRTUAL;

CREATE INDEX idx_vehicles_matched_status_sort ON vehicles(matched, status, sort_at DESC);
CREATE INDEX idx_events_vehicle_type_at ON events(vehicle_id, type, at);
CREATE INDEX idx_listings_vehicle_first_seen ON listings(vehicle_id, first_seen_at);
