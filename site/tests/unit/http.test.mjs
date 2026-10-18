// node --test tests/unit — response and body helpers shared by the Functions.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { json, error, readJson } from '../../functions/_lib/http.js';

const req = (body, headers = {}) => new Request('https://x.test/', { method: 'POST', body, headers });

test('json() and error() send nosniff and keep type and caching', () => {
  for (const res of [json({ a: 1 }), error('no', 404)]) {
    assert.equal(res.headers.get('X-Content-Type-Options'), 'nosniff');
    assert.equal(res.headers.get('Content-Type'), 'application/json; charset=utf-8');
    assert.equal(res.headers.get('Cache-Control'), 'no-store');
  }
});

test('readJson parses an object and rejects other shapes', async () => {
  assert.deepEqual((await readJson(req('{"a":1}'))).value, { a: 1 });
  assert.equal((await readJson(req('[1]'))).error, 'JSON object expected');
  assert.equal((await readJson(req('nope'))).error, 'Invalid JSON');
});

test('readJson refuses a declared Content-Length over the limit without reading the body', async () => {
  let read = false;
  const request = { headers: new Headers({ 'Content-Length': '2000' }), text: async () => ((read = true), '{}') };
  assert.equal((await readJson(request, 1000)).error, 'Request body too large');
  assert.equal(read, false);
});

test('readJson lets a body without Content-Length through to the size check', async () => {
  const request = { headers: new Headers(), text: async () => '{"a":1}' };
  assert.deepEqual((await readJson(request, 1000)).value, { a: 1 });
  const big = { headers: new Headers(), text: async () => JSON.stringify({ a: 'x'.repeat(2000) }) };
  assert.equal((await readJson(big, 1000)).error, 'Request body too large');
});

test('readJson measures bytes, not UTF-16 units', async () => {
  const body = JSON.stringify({ a: 'あ'.repeat(100) }); // ~320 bytes, ~110 units
  const request = { headers: new Headers(), text: async () => body };
  assert.equal((await readJson(request, 200)).error, 'Request body too large');
  assert.ok((await readJson({ headers: new Headers(), text: async () => body }, 400)).value);
});
