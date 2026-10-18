// node --test tests/unit — the posts API handlers on the in-memory D1.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createD1 } from './helpers/d1.mjs';
import { onRequestDelete, onRequestGet, onRequestPost, onRequestPut } from '../../functions/api/posts.js';

const call = async (handler, db, { method = 'GET', query = '', body } = {}) => {
  const request = new Request(`https://x.test/api/posts${query}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const res = await handler({ request, env: { DB: db } });
  return { status: res.status, body: await res.json() };
};
const create = (db, body) => call(onRequestPost, db, { method: 'POST', body });
const update = (db, body) => call(onRequestPut, db, { method: 'PUT', body });
const row = (db, id) => db.raw.prepare('SELECT * FROM posts WHERE id = ?').get(id);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

test('POST creates a draft with a slug from the title; invalid input is a 400', async () => {
  const db = createD1();
  const r = await create(db, { title: 'Hello World', content: 'c' });
  assert.equal(r.status, 201);
  assert.equal(r.body.slug, 'hello-world');
  assert.equal(r.body.status, 'draft');
  assert.equal(row(db, r.body.id).published_at, null);
  assert.equal((await create(db, { title: '', content: 'c' })).status, 400);
  assert.equal((await call(onRequestPost, db, { method: 'POST', body: [] })).status, 400);
});

test('POST as published sets published_at', async () => {
  const db = createD1();
  const r = await create(db, { title: 'P', content: 'c', status: 'published' });
  assert.ok(row(db, r.body.id).published_at);
});

test('slug collisions get -2, -3', async () => {
  const db = createD1();
  const slugs = [];
  for (let i = 0; i < 3; i++) slugs.push((await create(db, { title: 'Same', content: 'c' })).body.slug);
  assert.deepEqual(slugs, ['same', 'same-2', 'same-3']);
  assert.equal((await create(db, { title: 'x', slug: 'same', content: 'c' })).body.slug, 'same-4');
});

test('PUT keeps its own slug, and takes a free one or the next free suffix', async () => {
  const db = createD1();
  const a = (await create(db, { title: 'A', content: 'c' })).body;
  const b = (await create(db, { title: 'B', content: 'c' })).body;
  assert.equal((await update(db, { id: a.id, slug: 'a', title: 'A2' })).body.slug, 'a');
  assert.equal((await update(db, { id: a.id, title: 'A3' })).body.slug, 'a');
  assert.equal((await update(db, { id: a.id, slug: 'b' })).body.slug, 'b-2');
  assert.equal((await update(db, { id: b.id, slug: 'fresh' })).body.slug, 'fresh');
});

test('PUT: 400 without id, 404 for an unknown id, partial update keeps other fields', async () => {
  const db = createD1();
  assert.equal((await update(db, { title: 'x' })).status, 400);
  assert.equal((await update(db, { id: 'nope', title: 'x' })).status, 404);
  const a = (await create(db, { title: 'A', content: 'body', excerpt: 'ex', tags: ['t'] })).body;
  await update(db, { id: a.id, title: 'New' });
  const r = row(db, a.id);
  assert.deepEqual([r.title, r.content, r.excerpt, r.tags], ['New', 'body', 'ex', '["t"]']);
});

test('published_at is set on first publish and kept across unpublish and republish', async () => {
  const db = createD1();
  const a = (await create(db, { title: 'A', content: 'c' })).body;
  assert.equal(row(db, a.id).published_at, null);
  await update(db, { id: a.id, status: 'published' });
  const first = row(db, a.id).published_at;
  assert.ok(first);
  await sleep(5);
  await update(db, { id: a.id, status: 'draft' });
  assert.equal(row(db, a.id).published_at, first);
  await update(db, { id: a.id, status: 'published' });
  assert.equal(row(db, a.id).published_at, first);
  assert.notEqual(row(db, a.id).updated_at, first);
});

test('DELETE removes a post; 400 without id; 404 when missing', async () => {
  const db = createD1();
  const a = (await create(db, { title: 'A', content: 'c' })).body;
  assert.equal((await call(onRequestDelete, db, { method: 'DELETE' })).status, 400);
  assert.equal((await call(onRequestDelete, db, { method: 'DELETE', query: '?id=nope' })).status, 404);
  assert.equal((await call(onRequestDelete, db, { method: 'DELETE', query: `?id=${a.id}` })).status, 200);
  assert.equal(row(db, a.id), undefined);
});

test('GET: public sees published only; slug and admin id lookups', async () => {
  const db = createD1();
  const pub = (await create(db, { title: 'Pub', content: 'c', status: 'published' })).body;
  const draft = (await create(db, { title: 'Draft', content: 'c' })).body;
  assert.equal((await call(onRequestGet, db)).body.posts.length, 1);
  assert.equal((await call(onRequestGet, db, { query: '?status=all' })).body.posts.length, 2);
  assert.equal((await call(onRequestGet, db, { query: '?slug=pub' })).body.post.id, pub.id);
  assert.equal((await call(onRequestGet, db, { query: '?slug=draft' })).status, 404);
  assert.equal((await call(onRequestGet, db, { query: `?status=all&id=${draft.id}` })).body.post.id, draft.id);
  assert.equal((await call(onRequestGet, db, { query: '?status=all&id=nope' })).status, 404);
});

test('GET pagination at the boundaries', async () => {
  const db = createD1();
  for (let i = 0; i < 5; i++) await create(db, { title: `P${i}`, content: 'c', status: 'published' });
  const page = async (q) => (await call(onRequestGet, db, { query: q })).body.pagination;
  assert.deepEqual(await page('?limit=2&page=1'), { page: 1, limit: 2, total: 5, totalPages: 3, hasNext: true, hasPrev: false });
  assert.deepEqual(await page('?limit=2&page=3'), { page: 3, limit: 2, total: 5, totalPages: 3, hasNext: false, hasPrev: true });
  assert.equal((await page('?limit=5')).hasNext, false);
  assert.equal((await page('?limit=5')).totalPages, 1);
  const beyond = await call(onRequestGet, db, { query: '?limit=2&page=9' });
  assert.deepEqual(beyond.body.posts, []);
  assert.equal(beyond.body.pagination.hasNext, false);
  assert.equal((await page('?page=0')).page, 1);
  assert.equal((await page('?page=-3')).page, 1);
  assert.equal((await page('?limit=999')).limit, 50);
  assert.equal((await page('?limit=abc')).limit, 10);
  assert.equal((await page('?limit=0')).limit, 10);
});

test('GET on an empty table', async () => {
  const { body } = await call(onRequestGet, createD1());
  assert.deepEqual(body.posts, []);
  assert.equal(body.pagination.totalPages, 0);
});
