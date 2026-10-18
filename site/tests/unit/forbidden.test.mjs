// node --test tests/unit — the forbidden-string check shared by the e2e suite, privacy-check and cms.mjs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { FORBIDDEN, findForbidden } from '../../scripts/forbidden.mjs';

test('findForbidden returns the numbers of the strings found, never the strings', () => {
  assert.deepEqual(findForbidden('a plain post about printing'), []);
  assert.deepEqual(findForbidden(`x ${FORBIDDEN[1]} y ${FORBIDDEN[4]}`), [2, 5]);
});

test('cms.mjs push refuses a post with a forbidden string before sending anything', () => {
  const dir = mkdtempSync(join(tmpdir(), 'cms-'));
  const file = join(dir, 'post.md');
  writeFileSync(file, `---\ntitle: test\nslug: test\n---\n本文 ${FORBIDDEN[0]}\n`);
  // An unreachable CMS_URL: if the check let the post through, the script would fail on the
  // network instead, with a different message.
  const env = { ...process.env, CMS_URL: 'http://127.0.0.1:9', HTTPS_PROXY: '', https_proxy: '' };
  const res = spawnSync(process.execPath, ['scripts/cms.mjs', 'push', file], { encoding: 'utf8', env });
  assert.equal(res.status, 1);
  assert.match(res.stderr, /forbidden string #1 .*Nothing was sent/);
  for (const word of FORBIDDEN) assert.ok(!res.stderr.includes(word) && !res.stdout.includes(word));
});
