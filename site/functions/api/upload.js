// Image upload (R2).
// POST /api/upload           multipart "file" (admin)
// GET  /api/upload?key=...   serve an uploaded image (public)
//
// SVG is not accepted: an SVG served from this origin can run script and reach the admin token.

import { error, json } from '../_lib/http.js';
import { imageSize } from '../_lib/imagesize.js';
import { KEY_RE } from '../_lib/posts.js';

const TYPES = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/gif': 'gif', 'image/webp': 'webp', 'image/avif': 'avif' };
const MAX_SIZE = 5 * 1024 * 1024;
const SNIFF_BYTES = 256; // enough for a PNG signature and a normal AVIF ftyp box

const ascii = (b, at, text) => text.length + at <= b.length && [...text].every((c, i) => b[at + i] === c.charCodeAt(0));

// Do the first bytes look like the declared image type? Only the signatures of the allowed types.
function matchesType(b, type) {
  switch (type) {
    case 'image/jpeg':
      return b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff;
    case 'image/png':
      return [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((v, i) => b[i] === v);
    case 'image/gif':
      return ascii(b, 0, 'GIF87a') || ascii(b, 0, 'GIF89a');
    case 'image/webp':
      return ascii(b, 0, 'RIFF') && ascii(b, 8, 'WEBP');
    case 'image/avif': {
      if (!ascii(b, 4, 'ftyp') || b.length < 12) return false;
      // Box size 0 (to the end) and 1 (64-bit size follows) are not worth parsing: scan what we have.
      const size = ((b[0] << 24) | (b[1] << 16) | (b[2] << 8) | b[3]) >>> 0;
      const end = size >= 16 ? Math.min(size, b.length) : b.length;
      // Major brand at 8, minor version at 12, compatible brands from 16
      for (let i = 8; i + 4 <= end; i += i === 8 ? 8 : 4) {
        if (ascii(b, i, 'avif') || ascii(b, i, 'avis')) return true;
      }
      return false;
    }
    default:
      return false;
  }
}

export async function onRequestGet({ request, env }) {
  if (!env.IMAGES) return error('Image storage is not configured', 503);
  const key = new URL(request.url).searchParams.get('key') || '';
  if (!KEY_RE.test(key)) return error('Image not found', 404);

  const object = await env.IMAGES.get(key);
  if (!object) return error('Image not found', 404);

  const type = object.httpMetadata?.contentType;
  if (!type || !Object.hasOwn(TYPES, type)) return error('Image not found', 404);

  return new Response(object.body, {
    headers: {
      'Content-Type': type,
      'Cache-Control': 'public, max-age=31536000, immutable',
      'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy': "default-src 'none'; sandbox",
      ETag: object.httpEtag,
    },
  });
}

export async function onRequestPost({ request, env }) {
  if (!env.IMAGES) return error('Image storage is not configured', 503);
  if (!(request.headers.get('Content-Type') || '').includes('multipart/form-data')) {
    return error('multipart/form-data required', 400);
  }

  let file;
  try {
    file = (await request.formData()).get('file');
  } catch {
    return error('Invalid form data', 400);
  }
  if (!file || typeof file === 'string') return error('No file provided', 400);
  if (!Object.hasOwn(TYPES, file.type)) return error('Allowed types: JPEG, PNG, GIF, WebP, AVIF', 400);
  if (file.size > MAX_SIZE) return error('File too large (max 5MB)', 400);
  // The declared type is the client's word; the stored Content-Type must match the bytes.
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (!matchesType(bytes.subarray(0, SNIFF_BYTES), file.type)) return error(`File content does not match its type (${file.type})`, 400);

  // The size goes into the key so pages can set width/height (no layout shift); unknown stays out
  const size = imageSize(bytes, file.type);
  const dims = size ? `-${size.width}x${size.height}` : '';
  const key = `blog/${Date.now()}-${crypto.randomUUID().slice(0, 8)}${dims}.${TYPES[file.type]}`;
  try {
    await env.IMAGES.put(key, bytes, { httpMetadata: { contentType: file.type } });
  } catch {
    return error('Upload failed', 500);
  }

  return json({ url: `/api/upload?key=${encodeURIComponent(key)}`, key, size: file.size, type: file.type }, 201);
}
