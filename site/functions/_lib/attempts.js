// In-app limit on failed admin logins, stored in D1.
// Cloudflare zone WAF rules never apply to *.pages.dev hosts (the project alias and every branch
// preview stay reachable), so this is the primary throttle; the WAF rule is a second layer.

const WINDOW = 15 * 60; // seconds
const PER_IP = 5; // failures per IP per window

const now = () => Math.floor(Date.now() / 1000);

// An IPv6 client usually owns a whole /64 and can rotate addresses inside it, so IPv6 is counted
// per /64. IPv4 (and IPv4-mapped IPv6) is counted per address; anything unparsable as is.
export function attemptKey(ip) {
  if (typeof ip !== 'string' || !ip.includes(':')) return ip;
  let text = ip.split('%')[0]; // drop a zone id (fe80::1%eth0)
  const v4 = /(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(text);
  if (v4) {
    const [a, b, c, d] = v4.slice(1).map(Number);
    if (Math.max(a, b, c, d) > 255) return ip;
    text = text.slice(0, v4.index) + ((a << 8) | b).toString(16) + ':' + ((c << 8) | d).toString(16);
  }
  const halves = text.split('::');
  if (halves.length > 2) return ip;
  const side = (part) => (part ? part.split(':') : []);
  const head = side(halves[0]);
  const tail = halves.length === 2 ? side(halves[1]) : [];
  const fill = 8 - head.length - tail.length;
  if (halves.length === 2 ? fill < 1 : fill !== 0) return ip;
  const groups = [...head, ...Array(halves.length === 2 ? fill : 0).fill('0'), ...tail];
  if (!groups.every((g) => /^[0-9a-f]{1,4}$/i.test(g))) return ip;
  const n = groups.map((g) => parseInt(g, 16));
  if (n.slice(0, 5).every((x) => x === 0) && n[5] === 0xffff) return `${n[6] >> 8}.${n[6] & 255}.${n[7] >> 8}.${n[7] & 255}`;
  return `${n.slice(0, 4).map((x) => x.toString(16)).join(':')}::/64`;
}

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
  const mine = await upsert.bind(attemptKey(ip), t, WINDOW).first();
  // Drop rows from earlier windows so the table does not grow with every address that ever
  // failed. A separate best-effort statement keeps the upsert above a single statement.
  await db.prepare('DELETE FROM login_attempts WHERE window_start < ?').bind(t - WINDOW).run().catch(() => {});
  return (mine?.failures ?? 0) > PER_IP;
}

// A successful login forgets this client's attempts.
export async function releaseAttempt(db, ip) {
  await db.prepare('DELETE FROM login_attempts WHERE key = ?').bind(attemptKey(ip)).run();
}

export const LOCK_SECONDS = WINDOW;
