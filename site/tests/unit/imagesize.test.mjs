// node --test tests/unit — intrinsic size from image bytes, and from an upload key.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { imageSize, sizeFromKey } from '../../functions/_lib/imagesize.js';

const text = (s) => [...s].map((c) => c.charCodeAt(0));
const be32 = (n) => [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255];
const le24 = (n) => [n & 255, (n >> 8) & 255, (n >> 16) & 255];
const box = (type, ...body) => {
  const bytes = body.flat();
  return [...be32(bytes.length + 8), ...text(type), ...bytes];
};
const full = (type, ...body) => box(type, 0, 0, 0, 0, ...body);
const u8 = (a) => new Uint8Array(a);
const dim = (width, height) => ({ width, height });

const hasConvert = () => {
  try {
    execFileSync('convert', ['-version'], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
};

test('real files from ImageMagick report their size', async (t) => {
  if (!hasConvert()) return t.skip('ImageMagick (convert) not available');
  const dir = mkdtempSync(join(tmpdir(), 'imagesize-'));
  try {
    const types = { png: 'image/png', gif: 'image/gif', jpg: 'image/jpeg', webp: 'image/webp' };
    for (const [ext, type] of Object.entries(types)) {
      const file = join(dir, `o.${ext}`);
      execFileSync('convert', ['-size', '37x23', 'gradient:red-blue', file]);
      assert.deepEqual(imageSize(u8(readFileSync(file)), type), dim(37, 23), ext);
    }
    const lossless = join(dir, 'l.webp');
    execFileSync('convert', ['-size', '37x23', 'gradient:red-blue', '-define', 'webp:lossless=true', lossless]);
    assert.deepEqual(imageSize(u8(readFileSync(lossless)), 'image/webp'), dim(37, 23), 'lossless webp');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// APP1 Exif segment holding one IFD0 entry: Orientation (0x0112)
const exif = (orientation, little = false) => {
  const u16 = (n) => (little ? [n & 255, n >> 8] : [n >> 8, n & 255]);
  const u32 = (n) => (little ? [n & 255, 0, 0, 0] : [0, 0, 0, n]);
  const tiff = [...text(little ? 'II' : 'MM'), ...u16(42), ...u32(8), ...u16(1), ...u16(0x0112), ...u16(3), ...u32(1), ...u16(orientation), 0, 0, ...u32(0)];
  const body = [...text('Exif'), 0, 0, ...tiff];
  return [0xff, 0xe1, ...be32(body.length + 2).slice(2), ...body];
};
const sof = (marker, w, h) => [0xff, marker, 0, 11, 8, h >> 8, h & 255, w >> 8, w & 255, 1, 1, 0x11, 0];
const jpeg = (...segments) => u8([0xff, 0xd8, ...segments.flat(), 0xff, 0xda, 0, 2]);

test('JPEG: first SOF, skipping DHT, JPG and DAC markers and fill bytes', () => {
  const dht = [0xff, 0xc4, 0, 4, 0, 0];
  assert.deepEqual(imageSize(jpeg(dht, sof(0xc0, 37, 23)), 'image/jpeg'), dim(37, 23));
  assert.deepEqual(imageSize(jpeg([0xff], dht, sof(0xc2, 300, 200)), 'image/jpeg'), dim(300, 200));
  assert.deepEqual(imageSize(jpeg([0xff, 0xcc, 0, 4, 0, 0], sof(0xcf, 5, 6)), 'image/jpeg'), dim(5, 6));
  // no frame before the scan
  assert.equal(imageSize(jpeg(dht), 'image/jpeg'), null);
});

test('JPEG: EXIF orientation 5-8 swaps width and height, others keep them', () => {
  for (const little of [false, true]) {
    for (const o of [1, 2, 3, 4]) assert.deepEqual(imageSize(jpeg(exif(o, little), sof(0xc0, 37, 23)), 'image/jpeg'), dim(37, 23), `${o}`);
    for (const o of [5, 6, 7, 8]) assert.deepEqual(imageSize(jpeg(exif(o, little), sof(0xc0, 37, 23)), 'image/jpeg'), dim(23, 37), `${o}`);
  }
  // an Exif segment after the frame still counts
  assert.deepEqual(imageSize(jpeg(sof(0xc0, 37, 23), exif(6)), 'image/jpeg'), dim(23, 37));
  // an Exif segment without an orientation tag leaves the size as is
  assert.deepEqual(imageSize(jpeg([0xff, 0xe1, 0, 8, ...text('Exif'), 0, 0], sof(0xc0, 37, 23)), 'image/jpeg'), dim(37, 23));
});

test('JPEG: Exif orientation spliced into a real file (ImageMagick)', async (t) => {
  if (!hasConvert()) return t.skip('ImageMagick (convert) not available');
  const dir = mkdtempSync(join(tmpdir(), 'imagesize-'));
  try {
    const file = join(dir, 'o.jpg');
    execFileSync('convert', ['-size', '37x23', 'xc:red', file]);
    const real = readFileSync(file);
    const rotated = u8([...real.subarray(0, 2), ...exif(6), ...real.subarray(2)]);
    assert.deepEqual(imageSize(rotated, 'image/jpeg'), dim(23, 37));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('PNG: IHDR, and an eXIf chunk with rotation', () => {
  const chunk = (type, ...data) => [...be32(data.flat().length), ...text(type), ...data.flat(), 0, 0, 0, 0];
  const sig = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  const ihdr = chunk('IHDR', be32(37), be32(23), 8, 2, 0, 0, 0);
  assert.deepEqual(imageSize(u8([...sig, ...ihdr, ...chunk('IDAT', 0)]), 'image/png'), dim(37, 23));
  const tiff = exif(6).slice(10); // the TIFF block of the Exif APP1 segment
  assert.deepEqual(imageSize(u8([...sig, ...ihdr, ...chunk('eXIf', tiff), ...chunk('IDAT', 0)]), 'image/png'), dim(23, 37));
});

test('WebP: VP8X, VP8L and VP8 headers', () => {
  const riff = (...chunk) => u8([...text('RIFF'), ...be32(0), ...text('WEBP'), ...chunk.flat()]);
  const vp8x = (flags, w, h) => [...text('VP8X'), 10, 0, 0, 0, flags, 0, 0, 0, ...le24(w - 1), ...le24(h - 1)];
  assert.deepEqual(imageSize(riff(vp8x(0x10, 37, 23)), 'image/webp'), dim(37, 23));
  assert.deepEqual(imageSize(riff(vp8x(0, 20000, 1)), 'image/webp'), dim(20000, 1));
  assert.equal(imageSize(riff(vp8x(0, 20001, 1)), 'image/webp'), null);
  // an EXIF chunk may rotate it: size unknown
  assert.equal(imageSize(riff(vp8x(0x08, 37, 23)), 'image/webp'), null);
  const bits = (36 | (22 << 14)) >>> 0;
  const vp8l = [...text('VP8L'), 5, 0, 0, 0, 0x2f, bits & 255, (bits >> 8) & 255, (bits >> 16) & 255, bits >>> 24];
  assert.deepEqual(imageSize(riff(vp8l), 'image/webp'), dim(37, 23));
  const vp8 = [...text('VP8 '), 10, 0, 0, 0, 0, 0, 0, 0x9d, 0x01, 0x2a, 37, 0, 23, 0];
  assert.deepEqual(imageSize(riff(vp8), 'image/webp'), dim(37, 23));
});

test('GIF: logical screen', () => {
  assert.deepEqual(imageSize(u8([...text('GIF89a'), 37, 0, 23, 0, 0, 0, 0]), 'image/gif'), dim(37, 23));
  assert.equal(imageSize(u8([...text('GIF89a'), 0, 0, 23, 0]), 'image/gif'), null);
});

test('AVIF: ispe inside meta/iprp/ipco', () => {
  const ispe = (w, h) => full('ispe', be32(w), be32(h));
  const avif = (...props) => u8([...box('ftyp', text('avif'), 0, 0, 0, 0, text('avif')), ...full('meta', box('iprp', box('ipco', ...props)))]);
  assert.deepEqual(imageSize(avif(ispe(37, 23)), 'image/avif'), dim(37, 23));
  assert.deepEqual(imageSize(avif(ispe(37, 23), ispe(37, 23)), 'image/avif'), dim(37, 23));
  // several different sizes (grid, thumbnail), rotation or crop: unknown
  assert.equal(imageSize(avif(ispe(37, 23), ispe(8, 8)), 'image/avif'), null);
  assert.equal(imageSize(avif(ispe(37, 23), box('irot', 1)), 'image/avif'), null);
  assert.equal(imageSize(avif(ispe(37, 23), box('clap', new Array(32).fill(0))), 'image/avif'), null);
  assert.equal(imageSize(avif(box('pixi', 3)), 'image/avif'), null);
  assert.equal(imageSize(u8(box('ftyp', text('avif'))), 'image/avif'), null);
});

test('truncated, garbage and mismatched input give null without throwing', () => {
  const types = ['image/png', 'image/gif', 'image/jpeg', 'image/webp', 'image/avif', 'image/svg+xml'];
  const samples = [u8([]), u8([0xff, 0xd8, 0xff]), u8(text('RIFF')), u8(new Array(40).fill(0xff)), new TextEncoder().encode('hello, not an image'), u8([0xff, 0xd8, 0xff, 0xe1, 0xff, 0xff, ...text('Exif'), 0, 0, ...text('MM')])];
  for (const type of types) for (const bytes of samples) assert.equal(imageSize(bytes, type), null, type);
  const png = u8([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, ...text('IHDR'), ...be32(37)]);
  assert.equal(imageSize(png, 'image/png'), null);
});

test('sizeFromKey reads -WxH from same-site upload URLs and bare keys only', () => {
  const key = 'blog/1700000000000-0123abcd-37x23.png';
  assert.deepEqual(sizeFromKey(`/api/upload?key=${encodeURIComponent(key)}`), dim(37, 23));
  assert.deepEqual(sizeFromKey(`/api/upload?key=${key}`), dim(37, 23));
  assert.deepEqual(sizeFromKey(key), dim(37, 23));
  assert.equal(sizeFromKey('/api/upload?key=blog/1700000000000-0123abcd.png'), null);
  assert.equal(sizeFromKey(`https://e.com/api/upload?key=${key}`), null);
  assert.equal(sizeFromKey(`/api/upload?key=${key}&x=1`), null);
  assert.equal(sizeFromKey('/api/upload?key=blog/1-0123abcd-30000x5.png'), null);
  assert.equal(sizeFromKey('/api/upload?key=%E0%A4%A'), null);
  assert.equal(sizeFromKey('/a-37x23.png'), null);
});
