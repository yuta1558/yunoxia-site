// Auth gate for /api/*.
// Public: GET /api/posts (published only), GET /api/upload?key=..., POST /api/auth/login.
// Everything else needs a valid Bearer JWT. The admin UI is same-origin, so no CORS headers
// are sent: browsers on other origins cannot call the write endpoints.

import { error } from '../_lib/http.js';
import { verifyJWT } from '../_lib/jwt.js';

function isPublic(request, url) {
  if (url.pathname === '/api/auth/login' && request.method === 'POST') return true;
  if (request.method !== 'GET') return false;
  if (url.pathname === '/api/upload') return true;
  // `status` asks for drafts, which only the admin may see.
  return url.pathname === '/api/posts' && !url.searchParams.has('status');
}

export async function onRequest(context) {
  const { request, env, next } = context;
  const url = new URL(request.url);

  if (!env.DB) return error('CMS is not configured (missing D1 binding DB)', 503);

  if (!isPublic(request, url)) {
    const auth = request.headers.get('Authorization') || '';
    if (!auth.startsWith('Bearer ')) return error('Unauthorized', 401);
    if (!env.JWT_SECRET) return error('Server configuration error', 500);
    const payload = await verifyJWT(auth.slice(7), env.JWT_SECRET);
    if (!payload) return error('Invalid or expired token', 401);
    context.data.user = payload;
  }

  const response = await next();
  const headers = new Headers(response.headers);
  headers.set('X-Robots-Tag', 'noindex');
  return new Response(response.body, { status: response.status, headers });
}
