// node --test tests/unit — image upload and serving, with a Map standing in for R2.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { stripJpegMetadata } from '../../scripts/lib/images.mjs';
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
// Smallest signatures the endpoint accepts, padded so the file is not just the signature.
const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0x0d];
const pad = (bytes) => new Uint8Array([...bytes, ...new Uint8Array(20)]);
const text = (s) => [...s].map((c) => c.charCodeAt(0));
// ftyp box: size, "ftyp", major brand, minor version, compatible brands
const ftyp = (major, ...compat) => {
  const body = [...text('ftyp'), ...text(major), 0, 0, 0, 0, ...compat.flatMap(text)];
  return pad([0, 0, 0, body.length + 4, ...body]);
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
  const res = await post(IMAGES, new File([pad(PNG)], 'a.png', { type: 'image/png' }));
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
  assert.equal((await post(IMAGES, new File([new Uint8Array([0xff, 0xd8, 0xff, ...new Uint8Array(max - 3)])], 'a.jpg', { type: 'image/jpeg' }))).status, 201);
  assert.equal((await post(IMAGES, new File([new Uint8Array([0xff, 0xd8, 0xff, ...new Uint8Array(max - 2)])], 'a.jpg', { type: 'image/jpeg' }))).status, 400);
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

const accepts = async (bytes, type) => {
  const IMAGES = bucket();
  const res = await post(IMAGES, new File([bytes], 'a', { type }));
  assert.equal(res.status, 201, type);
  assert.deepEqual([...IMAGES.store.get((await res.json()).key).body], [...bytes]);
};
const rejects = async (bytes, type) => {
  const IMAGES = bucket();
  const res = await post(IMAGES, new File([bytes], 'a', { type }));
  assert.equal(res.status, 400, type);
  assert.match((await res.json()).error, /does not match/);
  assert.equal(IMAGES.store.size, 0);
};

test('upload accepts what real encoders produce (ImageMagick)', async (t) => {
  try {
    execFileSync('convert', ['-version'], { stdio: 'ignore' });
  } catch {
    return t.skip('ImageMagick (convert) not available');
  }
  const dir = mkdtempSync(join(tmpdir(), 'upload-'));
  try {
    const types = { jpg: 'image/jpeg', png: 'image/png', gif: 'image/gif', webp: 'image/webp' };
    for (const [ext, type] of Object.entries(types)) {
      const file = join(dir, `o.${ext}`);
      execFileSync('convert', ['-size', '8x8', 'xc:red', file]);
      await accepts(new Uint8Array(readFileSync(file)), type);
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('upload accepts a JPEG after stripJpegMetadata', async (t) => {
  try {
    execFileSync('convert', ['-version'], { stdio: 'ignore' });
  } catch {
    return t.skip('ImageMagick (convert) not available');
  }
  const dir = mkdtempSync(join(tmpdir(), 'upload-'));
  try {
    const file = join(dir, 'o.jpg');
    execFileSync('convert', ['-size', '8x8', 'xc:red', '-comment', 'x', file]);
    await accepts(new Uint8Array(stripJpegMetadata(readFileSync(file))), 'image/jpeg');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('upload accepts the signatures of every allowed type, including AVIF brand layouts', async () => {
  await accepts(pad([0xff, 0xd8, 0xff, 0xe0]), 'image/jpeg');
  await accepts(pad(text('GIF87a')), 'image/gif');
  await accepts(pad(text('GIF89a')), 'image/gif');
  await accepts(pad([...text('RIFF'), 1, 2, 3, 4, ...text('WEBPVP8 ')]), 'image/webp');
  await accepts(ftyp('avif', 'mif1', 'avif'), 'image/avif');
  await accepts(ftyp('avis', 'msf1'), 'image/avif');
  await accepts(ftyp('mif1', 'miaf', 'avif'), 'image/avif');
  // a major brand alone, with the box cut at the buffer's end
  await accepts(new Uint8Array([0, 0, 0, 16, ...text('ftypavif')]), 'image/avif');
});

test('upload rejects bytes that do not match the declared type', async () => {
  await rejects(new TextEncoder().encode('hello, not an image'), 'image/png');
  await rejects(pad(PNG), 'image/jpeg');
  await rejects(new TextEncoder().encode('<!doctype html><script>alert(1)</script>'), 'image/webp');
  await rejects(pad([...text('RIFF'), 1, 2, 3, 4, ...text('WAVEfmt ')]), 'image/webp');
  await rejects(pad(text('GIF88a')), 'image/gif');
  await rejects(ftyp('heic', 'mif1', 'heix'), 'image/avif');
  // the avif brand outside the box (size 16 ends before it) does not count
  await rejects(new Uint8Array([0, 0, 0, 16, ...text('ftypheic'), 0, 0, 0, 0, ...text('avif')]), 'image/avif');
  // truncated: shorter than the signature, and empty
  await rejects(PNG.slice(0, 5), 'image/png');
  await rejects(new Uint8Array([0xff, 0xd8]), 'image/jpeg');
  await rejects(new Uint8Array(0), 'image/gif');
  await rejects(text('RIFF'), 'image/webp');
  await rejects(new Uint8Array([0, 0, 0, 16, ...text('ftyp')]), 'image/avif');
});
