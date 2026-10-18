// node --test tests/unit — the admin login limit holds under concurrent requests.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createD1 } from './helpers/d1.mjs';
import { onRequestPost } from '../../functions/api/auth/login.js';

const HASH = await (async () => {
  const { webcrypto } = await import('node:crypto');
  const salt = webcrypto.getRandomValues(new Uint8Array(16));
  const key = await webcrypto.subtle.importKey('raw', new TextEncoder().encode('right-password'), 'PBKDF2', false, ['deriveBits']);
  const bits = await webcrypto.subtle.deriveBits({ name: 'PBKDF2', salt, iterations: 10000, hash: 'SHA-256' }, key, 256);
  const b64 = (u) => Buffer.from(u).toString('base64');
  return `pbkdf2$10000$${b64(salt)}$${b64(new Uint8Array(bits))}`;
})();

const login = (db, password, ip = '203.0.113.1') =>
  onRequestPost({
    request: new Request('https://yunoxia.one/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'CF-Connecting-IP': ip },
      body: JSON.stringify({ username: 'admin', password }),
    }),
    env: { DB: db, JWT_SECRET: 'jwt-secret-0123456789abcdef0123456789', ADMIN_PASSWORD_HASH: HASH },
  }).then((r) => r.status);

test('parallel wrong passwords from one IP are cut off at the limit', async () => {
  const db = createD1();
  const statuses = await Promise.all(Array.from({ length: 20 }, () => login(db, 'wrong')));
  assert.equal(statuses.filter((s) => s === 401).length, 5);
  assert.equal(statuses.filter((s) => s === 429).length, 15);
});

test('a correct password logs in and does not count against the limit', async () => {
  const db = createD1();
  assert.equal(await login(db, 'wrong'), 401);
  assert.equal(await login(db, 'right-password'), 200);
  const rows = db.raw.prepare('SELECT key, failures FROM login_attempts ORDER BY key').all();
  assert.deepEqual(rows.map((r) => ({ ...r })), [{ key: '*', failures: 1 }]);
});

test('the sixth attempt in a window is refused, even with the right password', async () => {
  const db = createD1();
  for (let i = 0; i < 5; i++) assert.equal(await login(db, 'wrong'), 401);
  assert.equal(await login(db, 'right-password'), 429);
});
