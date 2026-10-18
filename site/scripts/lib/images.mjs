// Pure helpers for scripts/cms.mjs: JPEG, PNG and WebP metadata stripping, local image links in Markdown,
// and the headline check. No I/O, so tests can call them directly.
import { withFullStop } from '../../src/lib/headline.mjs';

export const isLocal = (src) => src && !/^(https?:)?\/\//.test(src) && !src.startsWith('/') && !src.startsWith('data:');

// JPEG segments that carry metadata: APP1 (EXIF, XMP: camera data, GPS position), APP13 (Photoshop
// IRB, IPTC: author, city) and COM (comment). APP0, APP2 (ICC profile) and APP14 (Adobe colour
// transform) stay: the picture decodes wrongly without them.
const JPEG_DROP = new Set([0xe1, 0xed, 0xfe]);

// Drop those segments and keep the image data. The admin UI re-encodes and shrinks images in the
// browser; Node has no image encoder, so the CLI only strips metadata and leaves resizing to whoever
// prepares the file. Not a JPEG: returned as is.
export function stripJpegMetadata(buf) {
  if (buf[0] !== 0xff || buf[1] !== 0xd8) return buf;
  const parts = [buf.subarray(0, 2)];
  let i = 2;
  while (i + 4 <= buf.length && buf[i] === 0xff) {
    const marker = buf[i + 1];
    if (marker === 0xda) break; // start of scan: the rest is image data
    const len = buf.readUInt16BE(i + 2);
    if (len < 2) break; // broken length: keep the rest untouched
    if (!JPEG_DROP.has(marker)) parts.push(buf.subarray(i, i + 2 + len));
    i += 2 + len;
  }
  if (i < buf.length) parts.push(buf.subarray(i));
  return Buffer.concat(parts);
}

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
// Text, EXIF and timestamp chunks. iCCP, sRGB, gAMA and the image chunks stay.
const PNG_DROP = new Set(['eXIf', 'tEXt', 'zTXt', 'iTXt', 'tIME']);

// Drop a PNG's metadata chunks (length, type, data, CRC) and keep the others byte for byte.
// Not a PNG: returned as is. A chunk that runs past the end stops the walk; the rest is kept.
export function stripPngMetadata(buf) {
  if (buf.length < 8 || !buf.subarray(0, 8).equals(PNG_SIGNATURE)) return buf;
  const parts = [buf.subarray(0, 8)];
  let i = 8;
  while (i + 12 <= buf.length) {
    const end = i + 12 + buf.readUInt32BE(i);
    if (end > buf.length) break; // broken length: keep the rest untouched
    if (!PNG_DROP.has(buf.toString('latin1', i + 4, i + 8))) parts.push(buf.subarray(i, end));
    i = end;
  }
  if (i < buf.length) parts.push(buf.subarray(i));
  return Buffer.concat(parts);
}

// Drop a WebP's EXIF and XMP chunks. Only the extended format (VP8X) has them; clear their flags and
// fix the RIFF size. Not a WebP, a simple VP8/VP8L file or broken sizes: returned as is.
export function stripWebpMetadata(buf) {
  if (buf.length < 12 || buf.toString('latin1', 0, 4) !== 'RIFF' || buf.toString('latin1', 8, 12) !== 'WEBP') return buf;
  if (buf.readUInt32LE(4) + 8 > buf.length) return buf; // declared size runs past the end
  if (buf.toString('latin1', 12, 16) !== 'VP8X' || buf.length < 30) return buf;
  const parts = [buf.subarray(0, 12)];
  let i = 12;
  let dropped = false;
  while (i + 8 <= buf.length) {
    const type = buf.toString('latin1', i, i + 4);
    const size = buf.readUInt32LE(i + 4);
    const end = i + 8 + size + (size & 1); // chunks are padded to even sizes
    if (end > buf.length + (size & 1)) return buf; // broken size
    if (type === 'EXIF' || type === 'XMP ') dropped = true;
    else parts.push(buf.subarray(i, Math.min(end, buf.length)));
    i = end;
  }
  if (!dropped) return buf;
  if (i < buf.length) parts.push(buf.subarray(i));
  const out = Buffer.concat(parts);
  out[20] &= ~0x0c; // VP8X flags byte: EXIF (bit 3) and XMP (bit 2)
  out.writeUInt32LE(out.length - 8, 4);
  return out;
}

// Strip what we can for this MIME type. GIF, AVIF and anything else are returned as is.
export function stripMetadata(buf, type) {
  switch (type) {
    case 'image/jpeg':
      return stripJpegMetadata(buf);
    case 'image/png':
      return stripPngMetadata(buf);
    case 'image/webp':
      return stripWebpMetadata(buf);
    default:
      return buf;
  }
}

// Run fn over the Markdown outside fenced code blocks and inline code spans; code is kept as is.
function mapOutsideCode(content, fn) {
  const out = [];
  let prose = '';
  let fence = null; // { char, size } while inside a fenced block
  const flush = () => {
    out.push(prose.split(/(``[^\n]*?``|`[^`\n]*`)/).map((part, n) => (n % 2 ? part : fn(part))).join(''));
    prose = '';
  };
  for (const line of content.split(/(?<=\n)/)) {
    const m = /^ {0,3}(`{3,}|~{3,})/.exec(line);
    if (fence) {
      out.push(line);
      if (m && m[1][0] === fence.char && m[1].length >= fence.size && !line.slice(m[0].length).trim()) fence = null;
    } else if (m) {
      flush();
      out.push(line);
      fence = { char: m[1][0], size: m[1].length };
    } else {
      prose += line;
    }
  }
  flush();
  return out.join('');
}

const IMAGE = /!\[([^\]]*)\]\(((?:[^()\s]|\([^()\s]*\))+)\)/g;

// Replace local image links with the URL upload(src) returns. Each distinct src is uploaded once;
// http(s) and root-relative links and anything in code are left alone.
export async function rewriteImages(content, upload) {
  const found = new Set();
  mapOutsideCode(content, (text) => {
    for (const [, , src] of text.matchAll(IMAGE)) if (isLocal(src)) found.add(src);
    return text;
  });
  const done = new Map();
  for (const src of found) done.set(src, await upload(src));
  return mapOutsideCode(content, (text) => text.replace(IMAGE, (all, alt, src) => (done.has(src) ? `![${alt}](${done.get(src)})` : all)));
}

// ## and ### (and setext) headings in the body that do not end in a full stop, by the site's own rule
// (src/lib/headline.mjs). Returns the heading texts.
export function headingsWithoutStop(content) {
  const missing = [];
  mapOutsideCode(content, (text) => {
    const check = (heading) => {
      if (withFullStop(heading, 'ja') !== heading || withFullStop(heading, 'en') !== heading) missing.push(heading);
    };
    for (const [, heading] of text.matchAll(/^ {0,3}#{2,3}[ \t]+(.+?)(?:[ \t]+#+)?[ \t]*$/gm)) check(heading);
    // Text over a --- or === line is a heading too (setext, as functions/_lib/markdown.js renders it)
    let para = [];
    for (const line of text.split('\n')) {
      if (/^ {0,3}(=+|-+)[ \t]*$/.test(line)) {
        if (para.length) check(para.join(' ')); // else a rule
        para = [];
      } else if (!line.trim() || /^ {0,3}(#|>|[-*+][ \t]|\d+\.[ \t])/.test(line)) para = [];
      else para.push(line.trim());
    }
    return text;
  });
  return missing;
}
