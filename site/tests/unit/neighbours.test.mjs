import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getNeighbours } from '../../functions/_lib/posts.js';
import { createD1 } from './helpers/d1.mjs';

function seed(db, rows) {
  const ins = db.raw.prepare(
    "INSERT INTO posts (id, slug, title, content, status, created_at, updated_at, published_at) VALUES (?, ?, ?, 'c', ?, 'x', 'x', ?)",
  );
  for (const [slug, status, at] of rows) ins.run(slug, slug, `T ${slug}`, status, at);
}

test('previous is the next older published post, next the next newer; drafts are skipped', async () => {
  const db = createD1();
  seed(db, [
    ['a', 'published', '2026-01-01T00:00:00Z'],
    ['b', 'draft', '2026-01-02T00:00:00Z'],
    ['c', 'published', '2026-01-03T00:00:00Z'],
    ['d', 'published', '2026-01-04T00:00:00Z'],
  ]);
  const { prev, next } = await getNeighbours(db, { slug: 'c', published_at: '2026-01-03T00:00:00Z' });
  assert.equal(prev.slug, 'a');
  assert.equal(next.slug, 'd');
  assert.deepEqual(await getNeighbours(db, { slug: 'a', published_at: '2026-01-01T00:00:00Z' }).then((n) => n.prev), null);
  assert.equal((await getNeighbours(db, { slug: 'd', published_at: '2026-01-04T00:00:00Z' })).next, null);
});

test('posts published at the same moment are ordered by slug', async () => {
  const db = createD1();
  const at = '2026-01-01T00:00:00Z';
  seed(db, [['x', 'published', at], ['y', 'published', at], ['z', 'published', at]]);
  const { prev, next } = await getNeighbours(db, { slug: 'y', published_at: at });
  assert.equal(prev.slug, 'x');
  assert.equal(next.slug, 'z');
});
