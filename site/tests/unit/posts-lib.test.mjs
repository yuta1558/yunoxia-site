// node --test tests/unit — validatePost and slugify.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { slugify, validatePost } from '../../functions/_lib/posts.js';

const ok = { title: 'T', content: 'C' };
const bad = (input, re, opts) => assert.throws(() => validatePost(input, opts), re);

test('title and content are required unless partial', () => {
  bad({ content: 'C' }, /title is required/);
  bad({ title: 'T' }, /content is required/);
  bad({ title: '  ', content: 'C' }, /title is required/);
  assert.deepEqual(validatePost({}, { partial: true }), {});
  bad({ title: 5, content: 'C' }, /must be a string/);
});

test('lengths are enforced and text is trimmed (content keeps its whitespace)', () => {
  assert.equal(validatePost({ title: ' a ', content: ' b ' }).title, 'a');
  assert.equal(validatePost({ title: 'a', content: ' b ' }).content, ' b ');
  assert.ok(validatePost({ title: 'x'.repeat(200), content: 'C' }));
  bad({ title: 'x'.repeat(201), content: 'C' }, /title is too long/);
  bad({ ...ok, excerpt: 'x'.repeat(501) }, /excerpt is too long/);
  bad({ ...ok, content: 'x'.repeat(200_001) }, /content is too long/);
});

test('control characters are stripped, tabs and newlines kept', () => {
  const out = validatePost({ title: 'a\u0000b\u0007', content: 'x\ty\nz\u001F', excerpt: 'e\u007F' });
  assert.deepEqual(out, { title: 'ab', content: 'x\ty\nz', excerpt: 'e' });
});

test('slug rules', () => {
  assert.equal(validatePost({ ...ok, slug: 'a-b-1' }).slug, 'a-b-1');
  assert.equal('slug' in validatePost({ ...ok, slug: '' }), false);
  for (const s of ['A', 'a_b', '-a', 'a-', 'a--b', 'あ', 5, 'a'.repeat(81)]) bad({ ...ok, slug: s }, /slug must be/);
  assert.ok(validatePost({ ...ok, slug: 'a'.repeat(80) }));
});

test('tags: trimmed, deduplicated, cleaned, limited', () => {
  assert.deepEqual(validatePost({ ...ok, tags: [' a ', 'a', 'b'] }).tags, ['a', 'b']);
  assert.deepEqual(validatePost({ ...ok, tags: ['a\u0000b', 'c\u001F'] }).tags, ['ab', 'c']);
  assert.deepEqual(validatePost({ ...ok, tags: ['a\u0000', 'a'] }).tags, ['a']);
  bad({ ...ok, tags: ['\u0000 '] }, /invalid tag/);
  bad({ ...ok, tags: [' '] }, /invalid tag/);
  bad({ ...ok, tags: [1] }, /invalid tag/);
  bad({ ...ok, tags: ['x'.repeat(41)] }, /invalid tag/);
  assert.ok(validatePost({ ...ok, tags: ['x'.repeat(40)] }));
  bad({ ...ok, tags: 'a' }, /tags must be an array/);
  bad({ ...ok, tags: Array.from({ length: 11 }, (_, i) => `t${i}`) }, /max 10/);
});

test('status', () => {
  assert.equal(validatePost({ ...ok, status: 'published' }).status, 'published');
  bad({ ...ok, status: 'x' }, /status must be/);
});

test('featured_image must be a whole upload key, or empty', () => {
  const k = 'blog/1700000000000-0123abcd.jpg';
  assert.equal(validatePost({ ...ok, featured_image: `/api/upload?key=${encodeURIComponent(k)}` }).featured_image, `/api/upload?key=${encodeURIComponent(k)}`);
  assert.ok(validatePost({ ...ok, featured_image: `/api/upload?key=${k}` }));
  assert.equal(validatePost({ ...ok, featured_image: '  ' }).featured_image, '');
  assert.equal('featured_image' in validatePost(ok), false);
  for (const v of [
    '/api/upload?key=', '/api/upload?key=x', '/api/upload?key=blog%2F1-0123abcd.svg',
    `/api/upload?key=${k}&x=1`, `/api/upload?key=${k}#a`, '/api/upload?key=../blog/1-0123abcd.jpg',
    '/api/upload?key=%E0%A4%A', 'https://evil.example/a.jpg', `/api/upload?key=${k}"onerror=1`,
  ]) bad({ ...ok, featured_image: v }, /uploaded image/);
  bad({ ...ok, featured_image: 5 }, /must be a string/);
  // keys with the size (-WxH) and without it (older uploads) are both valid
  const sized = 'blog/1700000000000-0123abcd-37x23.jpg';
  assert.equal(validatePost({ ...ok, featured_image: `/api/upload?key=${encodeURIComponent(sized)}` }).featured_image, `/api/upload?key=${encodeURIComponent(sized)}`);
  bad({ ...ok, featured_image: '/api/upload?key=blog/1700000000000-0123abcd-0x23.jpg' }, /uploaded image/);
});

test('slugify', () => {
  assert.equal(slugify('Hello, World!  Again'), 'hello-world-again');
  assert.equal(slugify('--a--'), 'a');
  assert.equal(slugify('x'.repeat(100)).length, 80);
  assert.match(slugify('日本語のみ'), /^post-[0-9a-z]+$/);
});
