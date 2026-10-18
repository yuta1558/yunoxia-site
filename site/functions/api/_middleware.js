// Auth gate for /api/*.
// Public: GET /api/posts (published only), GET /api/upload?key=..., POST /api/auth/login.
// Everything else needs a valid Bearer JWT, or the API token (CMS_API_TOKEN) that scripts/cms.mjs
// uses so Claude can write posts without the admin password. The admin UI is same-origin, so no
// CORS headers are sent: browsers on other origins cannot call the write endpoints.

import { error } from '../_lib/http.js';
import { verifyJWT } from '../_lib/jwt.js';
import { timingSafeStringEqual } from '../_lib/password.js';

// A short token would be guessable, so one under 32 characters is ignored
const apiTokenOk = (token, expected) => typeof expected === 'string' && expected.length >= 32 && timingSafeStringEqual(token, expected);

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
    const bearer = auth.slice(7);
    if (apiTokenOk(bearer, env.CMS_API_TOKEN)) {
      context.data.user = { sub: 'api' };
    } else {
      if (!env.JWT_SECRET) return error('Server configuration error', 500);
      const payload = await verifyJWT(bearer, env.JWT_SECRET);
      if (!payload) return error('Invalid or expired token', 401);
      context.data.user = payload;
    }
  }

  const response = await next();
  const headers = new Headers(response.headers);
  headers.set('X-Robots-Tag', 'noindex');
  return new Response(response.body, { status: response.status, headers });
}
