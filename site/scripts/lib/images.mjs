// Pure helpers for scripts/cms.mjs: JPEG metadata stripping, local image links in Markdown,
// and the headline check. No I/O, so tests can call them directly.
import { withFullStop } from '../../src/lib/headline.mjs';

export const isLocal = (src) => src && !/^(https?:)?\/\//.test(src) && !src.startsWith('/') && !src.startsWith('data:');

// Drop a JPEG's APP1 segments (EXIF and XMP: camera data, GPS position) and keep the image data.
// The admin UI re-encodes and shrinks images in the browser; Node has no image encoder, so the CLI
// only strips metadata and leaves resizing to whoever prepares the file. Not a JPEG: returned as is.
export function stripJpegMetadata(buf) {
  if (buf[0] !== 0xff || buf[1] !== 0xd8) return buf;
  const parts = [buf.subarray(0, 2)];
  let i = 2;
  while (i + 4 <= buf.length && buf[i] === 0xff) {
    const marker = buf[i + 1];
    if (marker === 0xda) break; // start of scan: the rest is image data
    const len = buf.readUInt16BE(i + 2);
    if (len < 2) break; // broken length: keep the rest untouched
    if (marker !== 0xe1) parts.push(buf.subarray(i, i + 2 + len));
    i += 2 + len;
  }
  if (i < buf.length) parts.push(buf.subarray(i));
  return Buffer.concat(parts);
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
