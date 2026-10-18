-- Failed admin login attempts, for the in-app rate limit (functions/_lib/attempts.js).
-- Zone WAF rules do not cover *.pages.dev hosts, so the app limits attempts itself.

CREATE TABLE IF NOT EXISTS login_attempts (
  key TEXT PRIMARY KEY,           -- client IP, or '*' for the global counter
  failures INTEGER NOT NULL DEFAULT 0,
  window_start INTEGER NOT NULL   -- unix seconds
);
