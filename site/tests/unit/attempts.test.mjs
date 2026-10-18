// node --test tests/unit — old login_attempts rows are pruned.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createD1 } from './helpers/d1.mjs';
import { claimAttempt } from '../../functions/_lib/attempts.js';

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
