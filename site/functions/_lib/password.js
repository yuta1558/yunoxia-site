// Password verification with salted PBKDF2-SHA256.
// Stored format: pbkdf2$<iterations>$<salt base64>$<hash base64>
// Workers caps PBKDF2 at 100,000 iterations. See DEPLOY.md for generating the value.

const encoder = new TextEncoder();

function fromB64(text) {
  return Uint8Array.from(atob(text), (c) => c.charCodeAt(0));
}

async function derive(password, salt, iterations) {
  const key = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations }, key, 256);
  return new Uint8Array(bits);
}

function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

export async function verifyPassword(password, stored) {
  if (typeof password !== 'string' || typeof stored !== 'string') return false;
  const [scheme, iter, salt, hash] = stored.split('$');
  const iterations = Number(iter);
  if (scheme !== 'pbkdf2' || !Number.isInteger(iterations) || iterations < 10000 || iterations > 100000) {
    return false;
  }
  try {
    return timingSafeEqual(await derive(password, fromB64(salt), iterations), fromB64(hash));
  } catch {
    return false;
  }
}

export function timingSafeStringEqual(a, b) {
  return timingSafeEqual(encoder.encode(String(a)), encoder.encode(String(b)));
}
