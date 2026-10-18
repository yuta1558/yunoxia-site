// In-app limit on failed admin logins, stored in D1.
// Cloudflare zone WAF rules never apply to *.pages.dev hosts (the project alias and every branch
// preview stay reachable), so this is the primary throttle; the WAF rule is a second layer.

const WINDOW = 15 * 60; // seconds
const PER_IP = 5; // failures per IP per window

const now = () => Math.floor(Date.now() / 1000);

// Counts this attempt before the password is checked, and says whether it is over the limit.
// Counting first (one atomic upsert per key) means concurrent requests cannot all pass a check
// made before any of them was recorded.
export async function claimAttempt(db, ip) {
  const t = now();
  const upsert = db.prepare(
    `INSERT INTO login_attempts (key, failures, window_start) VALUES (?1, 1, ?2)
     ON CONFLICT(key) DO UPDATE SET
       failures = CASE WHEN ?2 - window_start >= ?3 THEN 1 ELSE failures + 1 END,
       window_start = CASE WHEN ?2 - window_start >= ?3 THEN ?2 ELSE window_start END
     RETURNING failures`
  );
  // There is no site-wide cap: one would let anyone lock the owner out by failing 30 times from
  // anywhere. Distributed guessing is answered by PBKDF2, a 20+ character random password and
  // the zone's WAF rule (DEPLOY.md 4-4).
  const mine = await upsert.bind(ip, t, WINDOW).first();
  // Drop rows from earlier windows so the table does not grow with every address that ever
  // failed. A separate best-effort statement keeps the upsert above a single statement.
  await db.prepare('DELETE FROM login_attempts WHERE window_start < ?').bind(t - WINDOW).run().catch(() => {});
  return (mine?.failures ?? 0) > PER_IP;
}

// A successful login forgets this client's attempts.
export async function releaseAttempt(db, ip) {
  await db.prepare('DELETE FROM login_attempts WHERE key = ?').bind(ip).run();
}

export const LOCK_SECONDS = WINDOW;
