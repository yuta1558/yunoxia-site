// Intrinsic size of an uploaded image, read from its bytes, and the size a key carries.
// api/upload.js stores the size in the key (blog/<ts>-<8hex>-<w>x<h>.<ext>), so pages can write
// width/height on the <img> without a database column and the text does not move when it loads.
// Sizes are as browsers display them: EXIF orientation 5-8 swaps width and height. When the size
// cannot be known for sure (truncated or odd file, rotation or crop we do not follow) the answer is
// null and the key has no size.

import { KEY_RE } from './posts.js';

export const MAX_DIMENSION = 20000;
const IMAGE_PREFIX = '/api/upload?key=';

const ascii = (b, at, text) => at + text.length <= b.length && [...text].every((c, i) => b[at + i] === c.charCodeAt(0));
const u16be = (b, at) => (b[at] << 8) | b[at + 1];
const u32be = (b, at) => ((b[at] << 24) | (b[at + 1] << 16) | (b[at + 2] << 8) | b[at + 3]) >>> 0;

// {width, height} when both are whole numbers in 1..MAX_DIMENSION, else null
function sized(width, height) {
  const ok = (n) => Number.isInteger(n) && n >= 1 && n <= MAX_DIMENSION;
  return ok(width) && ok(height) ? { width, height } : null;
}

// Orientation (1-8) from TIFF data starting at `at`, or 1 when there is no tag.
function exifOrientation(b, at) {
  const little = ascii(b, at, 'II');
  if (!little && !ascii(b, at, 'MM')) return 1;
  const v = new DataView(b.buffer, b.byteOffset, b.byteLength);
  const u16 = (o) => v.getUint16(o, little);
  if (u16(at + 2) !== 42) return 1;
  const ifd = at + v.getUint32(at + 4, little);
  const count = u16(ifd);
  for (let i = 0; i < count; i++) {
    const entry = ifd + 2 + i * 12;
    if (u16(entry) === 0x0112) {
      const n = u16(entry + 8);
      return n >= 1 && n <= 8 ? n : 1;
    }
  }
  return 1;
}

const upright = (w, h, orientation) => (orientation >= 5 ? sized(h, w) : sized(w, h));

function png(b) {
  if (!ascii(b, 12, 'IHDR')) return null;
  const w = u32be(b, 16);
  const h = u32be(b, 20);
  // An eXIf chunk (before the pixel data) can rotate the picture
  let orientation = 1;
  for (let p = 8; p + 8 <= b.length; p += 12 + u32be(b, p)) {
    if (ascii(b, p + 4, 'IDAT')) break;
    if (ascii(b, p + 4, 'eXIf')) orientation = exifOrientation(b, p + 8);
  }
  return upright(w, h, orientation);
}

function gif(b) {
  return sized(b[6] | (b[7] << 8), b[8] | (b[9] << 8));
}

function jpeg(b) {
  let frame = null;
  let orientation = 1;
  let p = 2;
  while (p + 4 <= b.length) {
    if (b[p] !== 0xff) return null;
    const marker = b[p + 1];
    if (marker === 0xff) {
      p++; // fill byte
      continue;
    }
    // Markers without a length; the entropy-coded data after SOS holds no more headers
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd8)) {
      p += 2;
      continue;
    }
    if (marker === 0xd9 || marker === 0xda) break;
    const length = u16be(b, p + 2);
    if (marker === 0xe1 && ascii(b, p + 4, 'Exif\0\0')) orientation = exifOrientation(b, p + 10);
    // SOF0-SOF15 except DHT (c4), JPG (c8) and DAC (cc); a zero height means DNL defines it
    if (!frame && marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
      frame = { h: u16be(b, p + 5), w: u16be(b, p + 7) };
    }
    p += 2 + length;
  }
  return frame && upright(frame.w, frame.h, orientation);
}

function webp(b) {
  if (ascii(b, 12, 'VP8X')) {
    // Flags bit 3: an EXIF chunk follows, which may rotate the picture
    if (b[20] & 0x08) return null;
    return sized(1 + (b[24] | (b[25] << 8) | (b[26] << 16)), 1 + (b[27] | (b[28] << 8) | (b[29] << 16)));
  }
  if (ascii(b, 12, 'VP8L')) {
    if (b[20] !== 0x2f) return null;
    const bits = (b[21] | (b[22] << 8) | (b[23] << 16) | (b[24] << 24)) >>> 0;
    return sized(1 + (bits & 0x3fff), 1 + ((bits >>> 14) & 0x3fff));
  }
  if (ascii(b, 12, 'VP8 ')) {
    if (b[23] !== 0x9d || b[24] !== 0x01 || b[25] !== 0x2a) return null;
    return sized((b[26] | (b[27] << 8)) & 0x3fff, (b[28] | (b[29] << 8)) & 0x3fff);
  }
  return null;
}

// Child boxes of the box range [start, end): {type, body, end} where body is the content offset
function* boxes(b, start, end) {
  const limit = Math.min(end, b.length);
  for (let p = start; p + 8 <= limit; ) {
    let size = u32be(b, p);
    let body = p + 8;
    if (size === 1) {
      if (p + 16 > limit || u32be(b, p + 8) !== 0) return; // 64-bit size beyond 4 GB: not an image we take
      size = u32be(b, p + 12);
      body = p + 16;
    } else if (size === 0) {
      size = limit - p;
    }
    if (size < body - p) return;
    const next = Math.min(p + size, limit);
    yield { type: String.fromCharCode(b[p + 4], b[p + 5], b[p + 6], b[p + 7]), body, end: next };
    p = next;
  }
}

function avif(b) {
  const find = (type, start, end) => [...boxes(b, start, end)].find((box) => box.type === type);
  const meta = find('meta', 0, b.length);
  const iprp = meta && find('iprp', meta.body + 4, meta.end); // meta is a full box: 4 bytes of version and flags
  const ipco = iprp && find('ipco', iprp.body, iprp.end);
  if (!ipco) return null;
  const sizes = new Set();
  let first = null;
  for (const box of boxes(b, ipco.body, ipco.end)) {
    // Rotation and cropping change the displayed size; we do not follow them
    if (box.type === 'irot' || box.type === 'clap') return null;
    if (box.type === 'ispe' && box.body + 12 <= box.end) {
      first ??= sized(u32be(b, box.body + 4), u32be(b, box.body + 8));
      sizes.add(`${u32be(b, box.body + 4)}x${u32be(b, box.body + 8)}`);
    }
  }
  // Which ispe belongs to the main image is set in ipma; with several different sizes (grids, thumbnails) give up
  return sizes.size === 1 ? first : null;
}

// {width, height} of the image as a browser shows it, or null. `bytes` is the whole file; its
// type has been checked by the caller, but nothing here trusts the contents.
export function imageSize(bytes, type) {
  try {
    switch (type) {
      case 'image/png':
        return png(bytes);
      case 'image/gif':
        return gif(bytes);
      case 'image/jpeg':
        return jpeg(bytes);
      case 'image/webp':
        return webp(bytes);
      case 'image/avif':
        return avif(bytes);
      default:
        return null;
    }
  } catch {
    return null; // read past the end of a truncated file
  }
}

// {width, height} for a same-site upload URL whose key carries -<w>x<h>, else null
export function sizeFromKey(urlOrKey) {
  const value = String(urlOrKey);
  let key = value;
  if (value.startsWith(IMAGE_PREFIX)) {
    try {
      key = decodeURIComponent(value.slice(IMAGE_PREFIX.length));
    } catch {
      return null;
    }
  }
  if (!KEY_RE.test(key)) return null;
  const m = key.match(/-(\d+)x(\d+)\.\w+$/);
  return m ? sized(Number(m[1]), Number(m[2])) : null;
}
