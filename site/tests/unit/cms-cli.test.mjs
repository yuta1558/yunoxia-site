// node --test tests/unit — scripts/cms.mjs refuses a CMS_URL that is not https.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

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

// Dead endpoint on localhost: nothing leaves the machine
const cli = (args, extra = {}) =>
  spawnSync(process.execPath, [script, ...args], {
    encoding: 'utf8',
    timeout: 20000,
    env: { PATH: process.env.PATH, CMS_URL: 'http://127.0.0.1:9', ...extra },
  });
const tmp = mkdtempSync(join(tmpdir(), 'cms-cli-'));
const post = (name, text) => {
  const file = join(tmp, name);
  writeFileSync(file, text);
  return file;
};

test('a missing input file is a clean message', () => {
  const r = cli(['push', join(tmp, 'nope.md')]);
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /nope\.md: no such file/);
  assert.doesNotMatch(r.stderr, /ENOENT|\n\s+at /);
});

test('a missing image file is a clean message', () => {
  const file = post('img.md', '---\ntitle: T\nslug: t\n---\n![x](missing.png)\n');
  const r = cli(['push', file]);
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /missing\.png: no such file/);
  assert.doesNotMatch(r.stderr, /ENOENT|\n\s+at /);
});

test('flags work in any position and unknown ones are refused', () => {
  const file = post('ok.md', '---\ntitle: T\nslug: t\n---\n## 見出し。\n');
  const r = cli(['push', '--publish', file]);
  assert.match(r.stderr, /cannot reach/); // got as far as the request
  assert.doesNotMatch(r.stderr, /Usage/);
  const bad = cli(['push', file, '--publsh']);
  assert.notEqual(bad.status, 0);
  assert.match(bad.stderr, /Unknown option --publsh/);
});

test('push warns about a missing slug and headings without a full stop, but still goes on', () => {
  const file = post('warn.md', '---\ntitle: T\n---\n## 句点がない\n');
  const r = cli(['push', file]);
  assert.match(r.stderr, /no slug/);
  assert.match(r.stderr, /heading without a full stop: 句点がない/);
  assert.match(r.stderr, /cannot reach/);
  const quiet = cli(['push', post('quiet.md', '---\ntitle: T\nslug: t\n---\n## 句点がある。\n')]);
  assert.doesNotMatch(quiet.stderr, /warning/);
});

test('a CMS_URL without a scheme is a clean message', () => {
  const r = cli(['list'], { CMS_URL: 'example.com' });
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /CMS_URL is not a valid URL/);
  assert.doesNotMatch(r.stderr, /TypeError|\n\s+at /);
});

test('IPv6 loopback over http passes the check', () => {
  const r = cli(['list'], { CMS_URL: 'http://[::1]:9' });
  assert.doesNotMatch(r.stderr, /CMS_URL must be https/);
});
