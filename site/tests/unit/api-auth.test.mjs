// node --test tests/unit — the /api auth gate: admin JWT or the CLI's API token.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { onRequest } from '../../functions/api/_middleware.js';
import { signJWT } from '../../functions/_lib/jwt.js';

const TOKEN = 'cli-token-0123456789abcdef0123456789abcdef';
const run = async (auth, env = {}) => {
  const headers = auth ? { Authorization: auth } : {};
  const context = {
    request: new Request('https://yunoxia.one/api/posts?status=all', { headers }),
    env: { DB: {}, JWT_SECRET: 'jwt-secret-0123456789abcdef0123456789', ...env },
    data: {},
    next: async () => new Response('ok'),
  };
  const res = await onRequest(context);
  return { status: res.status, user: context.data.user };
};

test('no token is refused', async () => {
  assert.equal((await run('')).status, 401);
});

test('the API token passes when CMS_API_TOKEN is set', async () => {
  const r = await run(`Bearer ${TOKEN}`, { CMS_API_TOKEN: TOKEN });
  assert.equal(r.status, 200);
  assert.equal(r.user.sub, 'api');
});

test('a wrong API token is refused', async () => {
  assert.equal((await run(`Bearer ${TOKEN.slice(0, -1)}x`, { CMS_API_TOKEN: TOKEN })).status, 401);
});

test('a short CMS_API_TOKEN is ignored, so it cannot be guessed', async () => {
  assert.equal((await run('Bearer short', { CMS_API_TOKEN: 'short' })).status, 401);
});

test('without CMS_API_TOKEN, any token goes through the JWT check', async () => {
  assert.equal((await run(`Bearer ${TOKEN}`)).status, 401);
  assert.equal((await run('Bearer undefined')).status, 401);
});

test('the admin JWT still passes', async () => {
  const jwt = await signJWT({ sub: 'admin', exp: Math.floor(Date.now() / 1000) + 60 }, 'jwt-secret-0123456789abcdef0123456789');
  assert.equal((await run(`Bearer ${jwt}`, { CMS_API_TOKEN: TOKEN })).status, 200);
});
