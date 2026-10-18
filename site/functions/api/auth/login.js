// POST /api/auth/login — exchange the admin username/password for a 12-hour JWT.

import { error, json, readJson } from '../../_lib/http.js';
import { signJWT } from '../../_lib/jwt.js';
import { timingSafeStringEqual, verifyPassword } from '../../_lib/password.js';

const TOKEN_TTL = 12 * 60 * 60;

export async function onRequestPost({ request, env }) {
  if (!env.JWT_SECRET || !env.ADMIN_PASSWORD_HASH) return error('Server not configured', 500);

  const { value, error: bodyError } = await readJson(request, 4096);
  if (bodyError) return error(bodyError, 400);

  const { username, password } = value;
  if (typeof username !== 'string' || typeof password !== 'string' || !username || !password) {
    return error('Username and password required', 400);
  }

  const userOk = timingSafeStringEqual(username, env.ADMIN_USERNAME || 'admin');
  const passOk = await verifyPassword(password, env.ADMIN_PASSWORD_HASH);
  if (!userOk || !passOk) {
    // Flat delay to slow down guessing; pair with a Cloudflare rate-limiting rule (DEPLOY.md).
    await new Promise((resolve) => setTimeout(resolve, 600));
    return error('Invalid credentials', 401);
  }

  const now = Math.floor(Date.now() / 1000);
  const token = await signJWT({ sub: username, iat: now, exp: now + TOKEN_TTL }, env.JWT_SECRET);
  return json({ token, expiresIn: TOKEN_TTL });
}
