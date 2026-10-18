// node --test tests/unit — helpers of scripts/cms.mjs (image metadata, image links, headings)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { headingsWithoutStop, isLocal, rewriteImages, stripJpegMetadata, stripMetadata, stripPngMetadata, stripWebpMetadata } from '../../scripts/lib/images.mjs';

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

test('stripJpegMetadata also drops APP13 and COM, keeps APP0, APP2, APP14', () => {
  const soi = Buffer.from([0xff, 0xd8]);
  const keep = [segment(0xe0, Buffer.from('JFIF\0')), segment(0xe2, Buffer.from('ICC_PROFILE\0fake')), segment(0xee, Buffer.from('Adobe\0fake')), segment(0xdb, Buffer.alloc(10, 7))];
  const [app0, app2, app14, dqt] = keep;
  const app1 = segment(0xe1, Buffer.from('Exif\0\0GPSLatitude 0.0'));
  const app13 = segment(0xed, Buffer.from('Photoshop 3.0\0City Test'));
  const com = segment(0xfe, Buffer.from('Author Test'));
  const jpeg = Buffer.concat([soi, app0, app1, app2, app13, com, app14, dqt, SCAN]);
  const out = stripJpegMetadata(jpeg);
  assert.deepEqual(out, Buffer.concat([soi, app0, app2, app14, dqt, SCAN]));
  for (const text of ['GPS', 'City Test', 'Author Test']) assert.ok(!out.includes(text), text);
  assert.deepEqual([...out.subarray(0, 3)], [0xff, 0xd8, 0xff]);
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

test('headingsWithoutStop also checks text over --- or === (setext headings)', () => {
  const md = ['本文の見出し', '---', '', '区切り線の前の段落。', '', '---', '', '- 項目', '---', 'Two lines', 'of heading', '==='].join('\n');
  assert.deepEqual(headingsWithoutStop(md), ['本文の見出し', 'Two lines of heading']);
});

// ---- PNG and WebP -----------------------------------------------------------------------

// The signature check of functions/api/upload.js (matchesType), for the types handled here
const ascii = (b, at, text) => text.length + at <= b.length && [...text].every((c, i) => b[at + i] === c.charCodeAt(0));
const looksLike = (b, type) =>
  type === 'image/png'
    ? [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((v, i) => b[i] === v)
    : ascii(b, 0, 'RIFF') && ascii(b, 8, 'WEBP');

const hasConvert = (() => {
  try {
    execFileSync('convert', ['-version'], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
})();
const size = (file) => execFileSync('convert', [file, '-format', '%wx%h', 'info:']).toString();

const pngChunk = (type, data) => {
  const head = Buffer.alloc(8);
  head.writeUInt32BE(data.length);
  head.write(type, 4, 'latin1');
  return Buffer.concat([head, data, Buffer.alloc(4, 1)]); // CRC is not checked here
};
const chunkTypes = (png) => {
  const types = [];
  for (let i = 8; i + 12 <= png.length; i += 12 + png.readUInt32BE(i)) types.push(png.toString('latin1', i + 4, i + 8));
  return types;
};
const PNG_SIG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

test('stripPngMetadata drops text, EXIF and time chunks and keeps the rest byte for byte', () => {
  const keep = [pngChunk('IHDR', Buffer.alloc(13, 1)), pngChunk('iCCP', Buffer.from('icc\0\0fake')), pngChunk('sRGB', Buffer.from([0])), pngChunk('gAMA', Buffer.alloc(4, 2)), pngChunk('pHYs', Buffer.alloc(9, 3)), pngChunk('IDAT', Buffer.alloc(20, 4)), pngChunk('IEND', Buffer.alloc(0))];
  const drop = [pngChunk('tEXt', Buffer.from('Author\0Author Test')), pngChunk('zTXt', Buffer.from('Comment\0\0xx')), pngChunk('iTXt', Buffer.from('XML:com.adobe.xmp\0City Test')), pngChunk('eXIf', Buffer.from('MM\0*GPSLatitude 0.0')), pngChunk('tIME', Buffer.alloc(7))];
  const png = Buffer.concat([PNG_SIG, keep[0], drop[0], keep[1], drop[1], keep[2], drop[2], keep[3], drop[3], keep[4], drop[4], keep[5], keep[6]]);
  assert.deepEqual(stripPngMetadata(png), Buffer.concat([PNG_SIG, ...keep]));
});

test('stripPngMetadata returns other input unchanged and survives broken chunks', () => {
  const jpeg = Buffer.from([0xff, 0xd8, 0xff, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
  assert.equal(stripPngMetadata(jpeg), jpeg);
  const empty = Buffer.alloc(0);
  assert.equal(stripPngMetadata(empty), empty);
  const ihdr = pngChunk('IHDR', Buffer.alloc(13, 1));
  const huge = Buffer.concat([PNG_SIG, ihdr, Buffer.from([0xff, 0xff, 0xff, 0xff]), Buffer.from('tEXt'), Buffer.alloc(6)]);
  assert.deepEqual(stripPngMetadata(huge), huge);
  const cut = Buffer.concat([PNG_SIG, ihdr, pngChunk('tEXt', Buffer.from('Author\0Author Test')).subarray(0, 15)]);
  assert.deepEqual(stripPngMetadata(cut), cut);
  assert.deepEqual(stripPngMetadata(PNG_SIG.subarray(0, 5)), PNG_SIG.subarray(0, 5));
});

test('stripPngMetadata on a real PNG from ImageMagick', { skip: !hasConvert && 'ImageMagick not installed' }, () => {
  const dir = mkdtempSync(join(tmpdir(), 'images-test-'));
  try {
    const file = join(dir, 'in.png');
    execFileSync('convert', ['-size', '8x8', 'xc:red', '-set', 'comment', 'Author Test', '-define', 'png:include-chunk=tEXt', file]);
    const png = readFileSync(file);
    assert.ok(png.includes('Author Test'), 'fixture has a tEXt chunk');
    const out = stripPngMetadata(png);
    assert.ok(!out.includes('Author Test'));
    assert.ok(!chunkTypes(out).includes('tEXt'));
    assert.ok(looksLike(out, 'image/png'));
    writeFileSync(join(dir, 'out.png'), out);
    assert.equal(size(join(dir, 'out.png')), '8x8');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

const riffChunk = (type, data) => {
  const head = Buffer.alloc(8);
  head.write(type, 0, 'latin1');
  head.writeUInt32LE(data.length, 4);
  return Buffer.concat([head, data, Buffer.alloc(data.length & 1)]); // padded to even
};
const riff = (...chunks) => {
  const body = Buffer.concat([Buffer.from('WEBP'), ...chunks]);
  const head = Buffer.alloc(8);
  head.write('RIFF', 0, 'latin1');
  head.writeUInt32LE(body.length, 4);
  return Buffer.concat([head, body]);
};
const vp8x = (flags) => riffChunk('VP8X', Buffer.from([flags, 0, 0, 0, 7, 0, 0, 7, 0, 0]));
const webpTypes = (webp) => {
  const types = [];
  for (let i = 12; i + 8 <= webp.length; i += 8 + webp.readUInt32LE(i + 4) + (webp.readUInt32LE(i + 4) & 1)) types.push(webp.toString('latin1', i, i + 4));
  return types;
};

test('stripWebpMetadata drops EXIF and XMP chunks, clears the flags and fixes the RIFF size', () => {
  const iccp = riffChunk('ICCP', Buffer.from('fake icc!'));
  const image = riffChunk('VP8 ', Buffer.alloc(11, 5));
  const exif = riffChunk('EXIF', Buffer.from('MM\0*GPSLatitude 0.0')); // 19 bytes: odd, padded
  const xmp = riffChunk('XMP ', Buffer.from('<x>Author Test</x>')); // 18 bytes
  assert.equal(exif.length, 28);
  const webp = riff(vp8x(0x20 | 0x08 | 0x04 | 0x10), iccp, image, exif, xmp);
  const out = stripWebpMetadata(webp);
  assert.deepEqual(webpTypes(out), ['VP8X', 'ICCP', 'VP8 ']);
  assert.ok(!out.includes('GPS') && !out.includes('Author Test'));
  assert.equal(out[20], 0x20 | 0x10); // ICC and alpha flags stay
  assert.equal(out.readUInt32LE(4), out.length - 8);
  assert.deepEqual(out, riff(vp8x(0x20 | 0x10), iccp, image));
  assert.ok(looksLike(out, 'image/webp'));
});

test('stripWebpMetadata leaves simple files and other input unchanged', () => {
  const simple = riff(riffChunk('VP8L', Buffer.alloc(9, 5)));
  assert.equal(stripWebpMetadata(simple), simple);
  const noMeta = riff(vp8x(0x10), riffChunk('VP8 ', Buffer.alloc(10, 5)));
  assert.equal(stripWebpMetadata(noMeta), noMeta);
  const png = Buffer.concat([PNG_SIG, Buffer.alloc(30)]);
  assert.equal(stripWebpMetadata(png), png);
  const empty = Buffer.alloc(0);
  assert.equal(stripWebpMetadata(empty), empty);
});

test('stripWebpMetadata survives broken sizes', () => {
  const good = riff(vp8x(0x08), riffChunk('VP8 ', Buffer.alloc(10, 5)), riffChunk('EXIF', Buffer.from('GPSLatitude 0.0')));
  // RIFF size past the end
  const big = Buffer.from(good);
  big.writeUInt32LE(0xffffffff, 4);
  assert.deepEqual(stripWebpMetadata(big), big);
  // chunk size past the end
  const huge = Buffer.from(good);
  huge.writeUInt32LE(0xfffffff0, 34);
  assert.doesNotThrow(() => stripWebpMetadata(huge));
  assert.deepEqual(stripWebpMetadata(huge), huge);
  // cut anywhere
  for (let n = 0; n < good.length; n++) assert.doesNotThrow(() => stripWebpMetadata(good.subarray(0, n)), String(n));
});

test('stripWebpMetadata on a real WebP from ImageMagick with EXIF and XMP added', { skip: !hasConvert && 'ImageMagick not installed' }, () => {
  const dir = mkdtempSync(join(tmpdir(), 'images-test-'));
  try {
    // ImageMagick 6 cannot write EXIF into WebP: wrap its image data in a VP8X container by hand
    const file = join(dir, 'in.webp');
    execFileSync('convert', ['-size', '8x8', 'xc:red', file]);
    const plain = readFileSync(file);
    assert.equal(plain.toString('latin1', 12, 16), 'VP8 ');
    const image = plain.subarray(12);
    const webp = riff(vp8x(0x08 | 0x04), image, riffChunk('EXIF', Buffer.from('MM\0*GPSLatitude 0.0')), riffChunk('XMP ', Buffer.from('<x>Author Test</x>')));
    const out = stripWebpMetadata(webp);
    assert.ok(!out.includes('GPS') && !out.includes('Author Test'));
    assert.equal(out[20] & 0x0c, 0);
    assert.equal(out.readUInt32LE(4), out.length - 8);
    assert.ok(looksLike(out, 'image/webp'));
    writeFileSync(join(dir, 'out.webp'), out);
    assert.equal(size(join(dir, 'out.webp')), '8x8');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('stripMetadata picks the stripper by type and leaves GIF and AVIF alone', () => {
  const gif = Buffer.from('GIF89a......');
  assert.equal(stripMetadata(gif, 'image/gif'), gif);
  assert.equal(stripMetadata(gif, 'image/avif'), gif);
  const png = Buffer.concat([PNG_SIG, pngChunk('tEXt', Buffer.from('a\0b')), pngChunk('IEND', Buffer.alloc(0))]);
  assert.deepEqual(chunkTypes(stripMetadata(png, 'image/png')), ['IEND']);
  const webp = riff(vp8x(0x08), riffChunk('VP8 ', Buffer.alloc(10, 5)), riffChunk('EXIF', Buffer.from('x')));
  assert.deepEqual(webpTypes(stripMetadata(webp, 'image/webp')), ['VP8X', 'VP8 ']);
  assert.deepEqual(stripMetadata(Buffer.from([0xff, 0xd8, 0xff]), 'image/jpeg'), Buffer.from([0xff, 0xd8, 0xff]));
});

test('headingsWithoutStop reads a heading with inline code as one line', () => {
  assert.deepEqual(headingsWithoutStop('## 使う `G28`。\n\n## `G28` を使う\n'), ['`G28` を使う']);
});
