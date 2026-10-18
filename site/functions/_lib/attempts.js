// In-app limit on failed admin logins, stored in D1.
// Cloudflare zone WAF rules never apply to *.pages.dev hosts (the project alias and every branch
// preview stay reachable), so this is the primary throttle; the WAF rule is a second layer.

const WINDOW = 15 * 60; // seconds
const PER_IP = 5; // failures per IP per window
const GLOBAL = 30; // failures across all IPs per window (slows distributed guessing)

const now = () => Math.floor(Date.now() / 1000);

async function failures(db, key) {
  const row = await db.prepare('SELECT failures, window_start FROM login_attempts WHERE key = ?').bind(key).first();
  if (!row || now() - row.window_start >= WINDOW) return 0;
  return row.failures;
}

// Returns true when this client (or the site as a whole) must wait before trying again.
export async function isLocked(db, ip) {
  const [mine, all] = await Promise.all([failures(db, ip), failures(db, '*')]);
  return mine >= PER_IP || all >= GLOBAL;
}

export async function recordFailure(db, ip) {
  const t = now();
  const upsert = db.prepare(
    `INSERT INTO login_attempts (key, failures, window_start) VALUES (?1, 1, ?2)
     ON CONFLICT(key) DO UPDATE SET
       failures = CASE WHEN ?2 - window_start >= ?3 THEN 1 ELSE failures + 1 END,
       window_start = CASE WHEN ?2 - window_start >= ?3 THEN ?2 ELSE window_start END`
  );
  await db.batch([upsert.bind(ip, t, WINDOW), upsert.bind('*', t, WINDOW)]);
}

export async function clearFailures(db, ip) {
  await db.prepare('DELETE FROM login_attempts WHERE key = ?').bind(ip).run();
}

export const LOCK_SECONDS = WINDOW;
