// node --test tests/unit — old login_attempts rows are pruned.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createD1 } from './helpers/d1.mjs';
import { attemptKey, claimAttempt } from '../../functions/_lib/attempts.js';

const now = () => Math.floor(Date.now() / 1000);

test('a claim removes rows older than the window and keeps current ones', async () => {
  const db = createD1();
  const add = db.raw.prepare('INSERT INTO login_attempts (key, failures, window_start) VALUES (?, 3, ?)');
  add.run('old', now() - 16 * 60);
  add.run('recent', now() - 60);
  await claimAttempt(db, 'new');
  const keys = db.raw.prepare('SELECT key FROM login_attempts ORDER BY key').all().map((r) => r.key);
  assert.deepEqual(keys, ['new', 'recent']);
});

test('a failing prune does not break the claim', async () => {
  const db = createD1();
  const prepare = db.prepare;
  db.prepare = (sql) => (sql.startsWith('DELETE') ? { bind: () => ({ run: async () => { throw new Error('boom'); } }) } : prepare(sql));
  assert.equal(await claimAttempt(db, 'a'), false);
});

test('attemptKey: IPv6 is keyed by its /64, IPv4 and garbage are left alone', () => {
  assert.equal(attemptKey('2001:db8::1'), attemptKey('2001:0db8:0000:0000:ffff::2'));
  assert.equal(attemptKey('2001:db8::1'), '2001:db8:0:0::/64');
  assert.equal(attemptKey('2001:DB8:1:2:3:4:5:6'), '2001:db8:1:2::/64');
  assert.notEqual(attemptKey('2001:db8:0:1::1'), attemptKey('2001:db8:0:2::1'));
  assert.equal(attemptKey('::1'), '0:0:0:0::/64');
  assert.equal(attemptKey('::'), '0:0:0:0::/64');
  assert.equal(attemptKey('::ffff:192.0.2.1'), '192.0.2.1');
  assert.equal(attemptKey('::ffff:c000:201'), '192.0.2.1');
  assert.equal(attemptKey('192.0.2.1'), '192.0.2.1');
  assert.equal(attemptKey('fe80::1%eth0'), attemptKey('fe80::2'));
  for (const bad of ['unknown', '', 'a:b', '1::2::3', '1:2:3:4:5:6:7:8:9', 'g::1', '::ffff:999.0.0.1', '12345::1']) {
    assert.equal(attemptKey(bad), bad, bad);
  }
});

test('addresses in one /64 share one login counter', async () => {
  const db = createD1();
  for (let i = 1; i <= 5; i++) assert.equal(await claimAttempt(db, `2001:db8:0:0:${i}::${i}`), false);
  assert.equal(await claimAttempt(db, '2001:db8::ffff'), true);
  assert.equal(await claimAttempt(db, '2001:db8:0:1::1'), false);
  assert.equal(db.raw.prepare('SELECT COUNT(*) AS n FROM login_attempts').get().n, 2);
});
