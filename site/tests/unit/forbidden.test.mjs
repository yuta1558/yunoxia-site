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

const escaped = (s) => [...s].map((c) => `\\u${c.codePointAt(0).toString(16).padStart(4, '0')}`).join('');

for (const [name, post] of [
  ['in the body', `---\ntitle: test\nslug: test\n---\n本文 ${FORBIDDEN[0]}\n`],
  ['spelled as \\u escapes in a JSON title', `---\ntitle: "${escaped(FORBIDDEN[0])}"\nslug: test\n---\n本文\n`],
]) test(`cms.mjs push refuses a forbidden string ${name} before sending anything`, () => {
  const dir = mkdtempSync(join(tmpdir(), 'cms-'));
  const file = join(dir, 'post.md');
  writeFileSync(file, post);
  // An unreachable CMS_URL: if the check let the post through, the script would fail on the
  // network instead, with a different message.
  const env = { ...process.env, CMS_URL: 'http://127.0.0.1:9', HTTPS_PROXY: '', https_proxy: '' };
  const res = spawnSync(process.execPath, ['scripts/cms.mjs', 'push', file], { encoding: 'utf8', env });
  assert.equal(res.status, 1);
  assert.match(res.stderr, /forbidden string #1 .*Nothing was sent/);
  for (const word of FORBIDDEN) assert.ok(!res.stderr.includes(word) && !res.stdout.includes(word));
});
