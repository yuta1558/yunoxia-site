// node --test tests/unit — the CMS sitemap Function with a mocked D1.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { onRequestGet } from '../../functions/sitemap-posts.xml.js';

const request = new Request('https://yunoxia.one/sitemap-posts.xml');
const db = (results, fail = false) => ({
  prepare: () => ({
    all: async () => {
      if (fail) throw new Error('db down');
      return { results };
    },
  }),
});

test('no DB binding returns an empty urlset', async () => {
  const res = await onRequestGet({ request, env: {} });
  assert.equal(res.status, 200);
  assert.match(res.headers.get('Content-Type'), /application\/xml/);
  const body = await res.text();
  assert.match(body, /<urlset xmlns="http:\/\/www\.sitemaps\.org\/schemas\/sitemap\/0\.9"><\/urlset>/);
});

test('published posts become /log/p/<slug>/ with lastmod; invalid slugs are dropped', async () => {
  const res = await onRequestGet({
    request,
    env: {
      DB: db([
        { slug: 'hello-world', updated_at: '2026-10-18T01:00:00Z' },
        { slug: 'Bad Slug', updated_at: '2026-10-18T01:00:00Z' },
        { slug: 'no-date', updated_at: 'not a date' },
      ]),
    },
  });
  const body = await res.text();
  assert.match(body, /<loc>https:\/\/yunoxia\.one\/log\/p\/hello-world\/<\/loc><lastmod>2026-10-18T01:00:00\.000Z<\/lastmod>/);
  assert.match(body, /<loc>https:\/\/yunoxia\.one\/log\/p\/no-date\/<\/loc><\/url>/);
  assert.doesNotMatch(body, /Bad Slug/);
});

test('a database error still returns an empty, valid urlset', async () => {
  const res = await onRequestGet({ request, env: { DB: db(null, true) } });
  assert.equal(res.status, 200);
  assert.match(await res.text(), /<urlset[^>]*><\/urlset>/);
});
