// Image upload (R2).
// POST /api/upload           multipart "file" (admin)
// GET  /api/upload?key=...   serve an uploaded image (public)
//
// SVG is not accepted: an SVG served from this origin can run script and reach the admin token.

import { error, json } from '../_lib/http.js';

const TYPES = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/gif': 'gif', 'image/webp': 'webp', 'image/avif': 'avif' };
const MAX_SIZE = 5 * 1024 * 1024;
const KEY_RE = /^blog\/\d+-[0-9a-f]{8}\.(jpg|png|gif|webp|avif)$/;

export async function onRequestGet({ request, env }) {
  if (!env.IMAGES) return error('Image storage is not configured', 503);
  const key = new URL(request.url).searchParams.get('key') || '';
  if (!KEY_RE.test(key)) return error('Image not found', 404);

  const object = await env.IMAGES.get(key);
  if (!object) return error('Image not found', 404);

  const type = object.httpMetadata?.contentType;
  if (!type || !(type in TYPES)) return error('Image not found', 404);

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
  if (!(file.type in TYPES)) return error('Allowed types: JPEG, PNG, GIF, WebP, AVIF', 400);
  if (file.size > MAX_SIZE) return error('File too large (max 5MB)', 400);

  const key = `blog/${Date.now()}-${crypto.randomUUID().slice(0, 8)}.${TYPES[file.type]}`;
  try {
    await env.IMAGES.put(key, file.stream(), { httpMetadata: { contentType: file.type } });
  } catch {
    return error('Upload failed', 500);
  }

  return json({ url: `/api/upload?key=${encodeURIComponent(key)}`, key, size: file.size, type: file.type }, 201);
}
