// Authentication Middleware for Cloudflare Pages Functions
// Protects write operations (POST/PUT/DELETE) while allowing public reads

async function verifyJWT(token, secret) {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);

  const key = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['verify']
  );

  const parts = token.split('.');
  if (parts.length !== 3) return null;

  const [headerB64, payloadB64, signatureB64] = parts;
  const data = encoder.encode(`${headerB64}.${payloadB64}`);

  const signature = Uint8Array.from(
    atob(signatureB64.replace(/-/g, '+').replace(/_/g, '/')),
    (c) => c.charCodeAt(0)
  );

  const valid = await crypto.subtle.verify('HMAC', key, signature, data);
  if (!valid) return null;

  const payload = JSON.parse(
    atob(payloadB64.replace(/-/g, '+').replace(/_/g, '/'))
  );

  // Check expiration
  if (payload.exp && Date.now() / 1000 > payload.exp) return null;

  return payload;
}

function corsHeaders(origin) {
  return {
    'Access-Control-Allow-Origin': origin || '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
  };
}

export async function onRequest(context) {
  const { request, env, next } = context;
  const url = new URL(request.url);
  const method = request.method;
  const origin = request.headers.get('Origin') || '';

  // Handle CORS preflight
  if (method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: corsHeaders(origin),
    });
  }

  // Public endpoints: GET requests to posts API and auth endpoints
  const isAuthEndpoint = url.pathname.startsWith('/api/auth');
  const isPublicRead = method === 'GET' && !url.searchParams.has('status');

  if (isAuthEndpoint || isPublicRead) {
    const response = await next();
    const newHeaders = new Headers(response.headers);
    Object.entries(corsHeaders(origin)).forEach(([k, v]) =>
      newHeaders.set(k, v)
    );
    return new Response(response.body, {
      status: response.status,
      headers: newHeaders,
    });
  }

  // Protected endpoints: require JWT
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders(origin),
      },
    });
  }

  const token = authHeader.slice(7);
  const jwtSecret = env.JWT_SECRET;

  if (!jwtSecret) {
    return new Response(
      JSON.stringify({ error: 'Server configuration error' }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders(origin),
        },
      }
    );
  }

  const payload = await verifyJWT(token, jwtSecret);
  if (!payload) {
    return new Response(JSON.stringify({ error: 'Invalid or expired token' }), {
      status: 401,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders(origin),
      },
    });
  }

  // Attach user info to context
  context.data = context.data || {};
  context.data.user = payload;

  const response = await next();
  const newHeaders = new Headers(response.headers);
  Object.entries(corsHeaders(origin)).forEach(([k, v]) =>
    newHeaders.set(k, v)
  );
  return new Response(response.body, {
    status: response.status,
    headers: newHeaders,
  });
}
