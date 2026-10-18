// node --test tests/unit — image upload and serving, with a Map standing in for R2.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { onRequestGet, onRequestPost } from '../../functions/api/upload.js';

const bucket = () => {
  const store = new Map();
  return {
    store,
    put: async (key, stream, opts) => store.set(key, { body: Buffer.from(await new Response(stream).arrayBuffer()), httpMetadata: opts.httpMetadata }),
    get: async (key) => {
      const o = store.get(key);
      return o && { body: o.body, httpMetadata: o.httpMetadata, httpEtag: '"e"' };
    },
  };
};
const post = (IMAGES, file) => {
  const form = new FormData();
  if (file) form.append('file', file);
  return onRequestPost({ request: new Request('https://x.test/api/upload', { method: 'POST', body: form }), env: { IMAGES } });
};
const get = (IMAGES, key) =>
  onRequestGet({ request: new Request(`https://x.test/api/upload?key=${encodeURIComponent(key)}`), env: { IMAGES } });

test('upload stores an allowed image under a key that matches the pattern', async () => {
  const IMAGES = bucket();
  const res = await post(IMAGES, new File([new Uint8Array(10)], 'a.png', { type: 'image/png' }));
  assert.equal(res.status, 201);
  const body = await res.json();
  assert.match(body.key, /^blog\/\d+-[0-9a-f]{8}\.png$/);
  assert.equal(body.url, `/api/upload?key=${encodeURIComponent(body.key)}`);
  assert.equal(IMAGES.store.get(body.key).httpMetadata.contentType, 'image/png');
});

test('upload refuses other types (SVG included), missing files and non-multipart bodies', async () => {
  const IMAGES = bucket();
  for (const type of ['image/svg+xml', 'text/html', 'application/octet-stream', '']) {
    assert.equal((await post(IMAGES, new File(['x'], 'a', { type }))).status, 400, type);
  }
  assert.equal((await post(IMAGES, null)).status, 400);
  const json = await onRequestPost({ request: new Request('https://x.test/', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' }), env: { IMAGES } });
  assert.equal(json.status, 400);
  assert.equal(IMAGES.store.size, 0);
});

test('upload size limit is 5 MB', async () => {
  const IMAGES = bucket();
  const max = 5 * 1024 * 1024;
  assert.equal((await post(IMAGES, new File([new Uint8Array(max)], 'a.jpg', { type: 'image/jpeg' }))).status, 201);
  assert.equal((await post(IMAGES, new File([new Uint8Array(max + 1)], 'a.jpg', { type: 'image/jpeg' }))).status, 400);
});

test('without the R2 binding both methods answer 503', async () => {
  assert.equal((await post(undefined, new File(['x'], 'a.png', { type: 'image/png' }))).status, 503);
  assert.equal((await get(undefined, 'blog/1-01234567.png')).status, 503);
});

test('GET serves an image with nosniff, the sandbox CSP and its stored type', async () => {
  const IMAGES = bucket();
  const key = 'blog/1700000000000-0123abcd.webp';
  IMAGES.store.set(key, { body: Buffer.from('img'), httpMetadata: { contentType: 'image/webp' } });
  const res = await get(IMAGES, key);
  assert.equal(res.status, 200);
  assert.equal(res.headers.get('Content-Type'), 'image/webp');
  assert.equal(res.headers.get('X-Content-Type-Options'), 'nosniff');
  assert.equal(res.headers.get('Content-Security-Policy'), "default-src 'none'; sandbox");
  assert.match(res.headers.get('Cache-Control'), /immutable/);
});

test('GET refuses keys outside the pattern without touching the bucket', async () => {
  const IMAGES = bucket();
  IMAGES.get = async () => assert.fail('bucket read');
  for (const key of ['', 'x', '../blog/1-01234567.png', 'blog/1-01234567.svg', 'blog/1-0123456.png', 'blog/a-01234567.png', 'blog/1-01234567.png/x', 'other/1-01234567.png']) {
    assert.equal((await get(IMAGES, key)).status, 404, key);
  }
});

test('GET 404s for a missing object or a stored type that is not an image', async () => {
  const IMAGES = bucket();
  assert.equal((await get(IMAGES, 'blog/1-01234567.png')).status, 404);
  IMAGES.store.set('blog/2-01234567.png', { body: Buffer.from('<svg>'), httpMetadata: { contentType: 'image/svg+xml' } });
  assert.equal((await get(IMAGES, 'blog/2-01234567.png')).status, 404);
});
