// In-app limit on failed admin logins, stored in D1.
// Cloudflare zone WAF rules never apply to *.pages.dev hosts (the project alias and every branch
// preview stay reachable), so this is the primary throttle; the WAF rule is a second layer.

const WINDOW = 15 * 60; // seconds
const PER_IP = 5; // failures per IP per window
const GLOBAL = 30; // failures across all IPs per window (slows distributed guessing)

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
  const [mine, all] = await db.batch([upsert.bind(ip, t, WINDOW), upsert.bind('*', t, WINDOW)]);
  const count = (r) => r?.results?.[0]?.failures ?? 0;
  return count(mine) > PER_IP || count(all) > GLOBAL;
}

// A successful login forgets this client's attempts and takes its own attempt off the global count.
export async function releaseAttempt(db, ip) {
  await db.batch([
    db.prepare('DELETE FROM login_attempts WHERE key = ?').bind(ip),
    db.prepare("UPDATE login_attempts SET failures = MAX(failures - 1, 0) WHERE key = '*'"),
  ]);
}

export const LOCK_SECONDS = WINDOW;
