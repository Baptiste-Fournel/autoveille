CREATE TABLE sessions_with_expiry (
  token TEXT PRIMARY KEY,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
);

INSERT INTO sessions_with_expiry (token, created_at, expires_at)
SELECT token, created_at, strftime('%Y-%m-%dT%H:%M:%fZ', migration_instant(), '+180 days')
FROM sessions
ORDER BY rowid;

DROP TABLE sessions;

ALTER TABLE sessions_with_expiry RENAME TO sessions;
