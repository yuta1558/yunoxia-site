// node --test tests/unit — cms.mjs front matter: get → push gives back what was read.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parse, serialize } from '../../scripts/lib/frontmatter.mjs';

const post = (over) => ({
  title: 't',
  slug: 's',
  excerpt: '',
  tags: [],
  status: 'draft',
  featured_image: '',
  content: '本文\n',
  ...over,
});

test('awkward values survive a round trip', () => {
  for (const p of [
    post({ title: '"引用" について', excerpt: 'Note: C:\\tmp' }),
    post({ excerpt: '一行目\n二行目\nstatus: published' }),
    post({ title: ' 前後に空白 ', tags: ['a, b', 'c'] }),
    post({ title: '#3 の話', featured_image: '/api/upload?key=blog%2F1-0a0b0c0d.png' }),
    post({ title: "it's [fine]: yes" }),
  ]) {
    const { meta, content } = parse(serialize(p));
    assert.deepEqual({ ...meta, content }, p);
  }
});

test('hand-written front matter still parses', () => {
  const { meta, content } = parse('---\ntitle: 記事\ntags: [制作, "3D, プリンタ", \'x\']\nstatus: published\n---\n本文');
  assert.deepEqual(meta, { title: '記事', tags: ['制作', '3D, プリンタ', 'x'], status: 'published' });
  assert.equal(content, '本文');
});

test('only keys in the file are set, so an update leaves the rest alone', () => {
  assert.deepEqual(parse('---\ntitle: x\n---\n').meta, { title: 'x' });
});

test('a BOM and Windows newlines are accepted; no block gives null', () => {
  assert.deepEqual(parse('\uFEFF---\r\ntitle: x\r\n---\r\nbody').meta, { title: 'x' });
  assert.equal(parse('title: x\n'), null);
});
