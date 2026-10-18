// node --test tests/unit — scripts/cms.mjs refuses a CMS_URL that is not https.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';

const script = new URL('../../scripts/cms.mjs', import.meta.url).pathname;
// A proxy that nothing listens on: any request that got past the check would fail differently
const run = (url, extra = {}) =>
  spawnSync(process.execPath, [script, 'list'], {
    encoding: 'utf8',
    timeout: 20000,
    env: { PATH: process.env.PATH, CMS_URL: url, CMS_TOKEN: 'dummy', HTTPS_PROXY: 'http://127.0.0.1:9', ...extra },
  });

test('plain http to another host fails before any request', () => {
  for (const extra of [{}, { HTTPS_PROXY: '' }]) {
    const r = run('http://example.com', extra);
    assert.notEqual(r.status, 0);
    assert.match(r.stderr, /CMS_URL must be https/);
  }
});

test('localhost over http passes the check (and then fails to connect)', () => {
  for (const url of ['http://localhost:9', 'http://127.0.0.1:9']) {
    const r = run(url, { HTTPS_PROXY: '' });
    assert.notEqual(r.status, 0);
    assert.doesNotMatch(r.stderr, /CMS_URL must be https/);
  }
});
