// node --test tests/unit — hand-built Function responses send nosniff.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createD1 } from './helpers/d1.mjs';
import { onRequestGet as sitemap } from '../../functions/sitemap-posts.xml.js';
import { onRequestGet as updates } from '../../functions/updates.json.js';
import { onRequestGet as rss } from '../../functions/rss.xml.js';

const NOSNIFF = 'nosniff';

test('sitemap-posts.xml, with and without a database', async () => {
  for (const env of [{}, { DB: createD1() }]) {
    const res = await sitemap({ request: new Request('https://x.test/sitemap-posts.xml'), env });
    assert.equal(res.headers.get('X-Content-Type-Options'), NOSNIFF);
    assert.equal(res.headers.get('Content-Type'), 'application/xml; charset=utf-8');
  }
});

test('updates.json merges posts and sends nosniff', async () => {
  const db = createD1();
  db.raw.prepare("INSERT INTO posts (id, slug, title, content, status, created_at, updated_at, published_at) VALUES ('1','a','t','c','published','2026-01-01','2026-01-02','2026-01-01')").run();
  const next = async () => new Response('{"/x/":"2026-01-01"}', { headers: { 'Content-Type': 'application/json' } });
  const res = await updates({ env: { DB: db }, next });
  assert.equal(res.headers.get('X-Content-Type-Options'), NOSNIFF);
  assert.equal(res.headers.get('Cache-Control'), 'public, max-age=0, must-revalidate');
  assert.deepEqual(await res.json(), { '/x/': '2026-01-01', '/log/p/a/': '2026-01-02' });
});

test('rss.xml with CMS posts sends nosniff', async () => {
  const db = createD1();
  db.raw.prepare("INSERT INTO posts (id, slug, title, content, status, created_at, updated_at, published_at) VALUES ('1','a','t','c','published','2026-01-01','2026-01-02','2026-01-01T00:00:00Z')").run();
  const next = async () => new Response('<rss><channel><item></item></channel></rss>', { headers: { 'Content-Type': 'application/rss+xml' } });
  const res = await rss({ request: new Request('https://x.test/rss.xml'), env: { DB: db }, next });
  assert.equal(res.headers.get('X-Content-Type-Options'), NOSNIFF);
  assert.match(await res.text(), /\/log\/p\/a\//);
});
