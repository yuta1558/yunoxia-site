// node --test tests/unit — helpers of scripts/cms.mjs (JPEG metadata, image links, headings)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { headingsWithoutStop, isLocal, rewriteImages, stripJpegMetadata } from '../../scripts/lib/images.mjs';

const segment = (marker, payload) => Buffer.concat([Buffer.from([0xff, marker, (payload.length + 2) >> 8, (payload.length + 2) & 0xff]), payload]);
const SCAN = Buffer.from([0xff, 0xda, 0x00, 0x03, 0x00, 0xff, 0xe1, 0x12, 0x34, 0xff, 0xd9]); // data holds a fake 0xFFE1

test('stripJpegMetadata removes APP1 and keeps the scan byte for byte', () => {
  const exif = segment(0xe1, Buffer.concat([Buffer.from('Exif\0\0'), Buffer.from('GPSLatitude 35.0 GPSLongitude 139.0')]));
  const app0 = segment(0xe0, Buffer.from('JFIF\0'));
  const dqt = segment(0xdb, Buffer.alloc(10, 7));
  const jpeg = Buffer.concat([Buffer.from([0xff, 0xd8]), app0, exif, dqt, SCAN]);
  const out = stripJpegMetadata(jpeg);
  assert.deepEqual(out, Buffer.concat([Buffer.from([0xff, 0xd8]), app0, dqt, SCAN]));
  assert.ok(!out.includes('GPS'));
});

test('stripJpegMetadata returns other input unchanged', () => {
  const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 1, 2, 3]);
  assert.equal(stripJpegMetadata(png), png);
  const empty = Buffer.alloc(0);
  assert.equal(stripJpegMetadata(empty), empty);
});

test('stripJpegMetadata survives bad segment lengths', () => {
  const soi = Buffer.from([0xff, 0xd8]);
  // length runs past the end
  const truncated = Buffer.concat([soi, Buffer.from([0xff, 0xe1, 0xff, 0xff, 1, 2, 3])]);
  assert.doesNotThrow(() => stripJpegMetadata(truncated));
  // header cut short
  assert.doesNotThrow(() => stripJpegMetadata(Buffer.concat([soi, Buffer.from([0xff, 0xe1, 0x00])])));
  // length 0 and 1 must not loop
  for (const len of [0, 1]) {
    const bad = Buffer.concat([soi, Buffer.from([0xff, 0xe0, 0x00, len, 9, 9, 9, 9])]);
    assert.deepEqual(stripJpegMetadata(bad), bad);
  }
});

test('isLocal', () => {
  for (const src of ['a.png', './a.png', '../img/a.jpg', 'img/a b.png']) assert.ok(isLocal(src), src);
  for (const src of ['http://x.test/a.png', 'https://x.test/a.png', '//x.test/a.png', '/assets/a.png', 'data:image/png;base64,AA', '', undefined]) {
    assert.ok(!isLocal(src), String(src));
  }
});

test('rewriteImages replaces local paths, once per distinct path', async () => {
  const calls = [];
  const upload = async (src) => (calls.push(src), `https://img.test/${calls.length}.png`);
  const md = [
    '![a](pics/a.png) and ![again](pics/a.png)',
    '![p](pics/shot(1).png)',
    '![web](https://example.com/w.png) ![root](/assets/r.png)',
  ].join('\n');
  const out = await rewriteImages(md, upload);
  assert.deepEqual(calls, ['pics/a.png', 'pics/shot(1).png']);
  assert.equal(
    out,
    ['![a](https://img.test/1.png) and ![again](https://img.test/1.png)', '![p](https://img.test/2.png)', '![web](https://example.com/w.png) ![root](/assets/r.png)'].join('\n'),
  );
});

test('rewriteImages ignores fenced code and inline code', async () => {
  const calls = [];
  const upload = async (src) => (calls.push(src), 'https://img.test/u.png');
  const md = ['Example:', '', '```md', '![x](x.png)', '```', '', '~~~~', '![y](y.png)', '```', '![z](z.png)', '~~~~', '', 'Write `![i](i.png)` like so, then ![real](real.png).', ''].join('\n');
  const out = await rewriteImages(md, upload);
  assert.deepEqual(calls, ['real.png']);
  assert.equal(out, md.replace('![real](real.png)', '![real](https://img.test/u.png)'));
});

test('headingsWithoutStop follows the headline rule', () => {
  const md = [
    '## 終わった。',
    '## 句点がない',
    '### Rebuilding this site',
    '### Rebuilding this site.',
    '## HevORT-lite',
    '## どうする？',
    '## Done!',
    '#### 深い見出し',
    '# 題',
    '## 閉じ ##',
    '```',
    '## in code',
    '```',
  ].join('\n');
  assert.deepEqual(headingsWithoutStop(md), ['句点がない', 'Rebuilding this site', '閉じ']);
});
