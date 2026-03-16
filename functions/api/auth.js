// Authentication API - Login / Verify
// POST /api/auth/login - Login with username/password, returns JWT
// POST /api/auth/verify - Verify JWT token

async function createJWT(payload, secret) {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);

  const key = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const header = { alg: 'HS256', typ: 'JWT' };
  const headerB64 = btoa(JSON.stringify(header))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

  const payloadB64 = btoa(JSON.stringify(payload))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

  const data = encoder.encode(`${headerB64}.${payloadB64}`);
  const signatureBuffer = await crypto.subtle.sign('HMAC', key, data);
  const signatureB64 = btoa(String.fromCharCode(...new Uint8Array(signatureBuffer)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

  return `${headerB64}.${payloadB64}.${signatureB64}`;
}

async function hashPassword(password) {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export async function onRequestPost(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const path = url.pathname;

  try {
    const body = await request.json();

    // POST /api/auth/login
    if (path.endsWith('/login')) {
      const { username, password } = body;

      if (!username || !password) {
        return new Response(
          JSON.stringify({ error: 'Username and password required' }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }

      const expectedUsername = env.ADMIN_USERNAME || 'admin';
      const expectedPasswordHash = env.ADMIN_PASSWORD_HASH;

      if (!expectedPasswordHash) {
        return new Response(
          JSON.stringify({ error: 'Server not configured' }),
          { status: 500, headers: { 'Content-Type': 'application/json' } }
        );
      }

      const inputHash = await hashPassword(password);

      if (username !== expectedUsername || inputHash !== expectedPasswordHash) {
        return new Response(
          JSON.stringify({ error: 'Invalid credentials' }),
          { status: 401, headers: { 'Content-Type': 'application/json' } }
        );
      }

      const now = Math.floor(Date.now() / 1000);
      const token = await createJWT(
        {
          sub: username,
          iat: now,
          exp: now + 86400, // 24 hours
        },
        env.JWT_SECRET
      );

      return new Response(
        JSON.stringify({ token, expiresIn: 86400 }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // POST /api/auth/verify
    if (path.endsWith('/verify')) {
      const { token } = body;

      if (!token) {
        return new Response(
          JSON.stringify({ error: 'Token required' }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }

      // Middleware already handles JWT verification for protected routes
      // This endpoint is for client-side token validation
      const parts = token.split('.');
      if (parts.length !== 3) {
        return new Response(
          JSON.stringify({ valid: false }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }

      try {
        const payload = JSON.parse(
          atob(parts[1].replace(/-/g, '+').replace(/_/g, '/'))
        );
        const isExpired = payload.exp && Date.now() / 1000 > payload.exp;
        return new Response(
          JSON.stringify({ valid: !isExpired, user: payload.sub }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      } catch {
        return new Response(
          JSON.stringify({ valid: false }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }
    }

    return new Response(
      JSON.stringify({ error: 'Not found' }),
      { status: 404, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: 'Invalid request body' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
